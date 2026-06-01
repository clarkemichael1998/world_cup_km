/**
 * rate-players.mjs
 *
 * Uses the Anthropic Batches API (50% cheaper) to rate all players in players.json
 * on pure overall ability (58–94 scale), then recalculates rarity.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/rate-players.mjs
 *
 * Optional env vars:
 *   BATCH_SIZE=20   — players per API request (default: 20)
 *   POLL_INTERVAL=30000 — ms between poll checks (default: 30s)
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playersPath = path.join(__dirname, "../data/players.json");

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 20);
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL ?? 30_000);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getRarity(rating) {
  if (rating >= 93) return "icon";
  if (rating >= 86) return "legend";
  if (rating >= 78) return "epic";
  if (rating >= 70) return "rare";
  if (rating >= 58) return "common";
  return "clowns";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const SYSTEM_PROMPT = `You are a football analyst rating players for a World Cup 2026 fantasy card game.
Rate each player's PURE OVERALL ABILITY as an integer from 58 to 94.

Scale:
93–94  World's absolute best (Messi/Ronaldo-tier, current 2-3 best at their position globally)
86–92  Elite — regular starters at Champions League clubs, key national team players
78–85  Good — reliable starters at mid/top clubs, capable international players
70–77  Decent — squad players at good clubs, fringe international players
58–69  Fringe — reserves, players from weaker leagues/nations

Consider current form (2025/26 season), track record, club level, and international pedigree.
Return ONLY a JSON object: { "<id>": <rating>, ... } — integers only, no explanation.`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable not set.");
    process.exit(1);
  }

  const players = JSON.parse(readFileSync(playersPath, "utf-8"));
  console.log(`Loaded ${players.length} players.`);

  // Split into groups of BATCH_SIZE
  const groups = [];
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    groups.push(players.slice(i, i + BATCH_SIZE));
  }
  console.log(`Creating ${groups.length} requests (${BATCH_SIZE} players each)...`);

  // Build batch requests
  const requests = groups.map((group, i) => ({
    custom_id: `group-${i}`,
    params: {
      model: "claude-opus-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Rate these ${group.length} players:\n` +
            group
              .map((p) => `${p.id}: ${p.name} (${p.nation}, ${p.pos}, ${p.club})`)
              .join("\n"),
        },
      ],
    },
  }));

  // Submit batch
  console.log("Submitting batch...");
  const batch = await client.messages.batches.create({ requests });
  console.log(`Batch ID: ${batch.id}`);
  console.log(`Status: ${batch.processing_status}`);
  console.log(`Total requests: ${batch.request_counts.processing + batch.request_counts.succeeded + batch.request_counts.errored}`);

  // Poll until complete
  let current = batch;
  while (current.processing_status !== "ended") {
    console.log(`\nWaiting ${POLL_INTERVAL / 1000}s... (processing: ${current.request_counts.processing})`);
    await sleep(POLL_INTERVAL);
    current = await client.messages.batches.retrieve(batch.id);
    console.log(`Status: ${current.processing_status} — succeeded: ${current.request_counts.succeeded}, errored: ${current.request_counts.errored}`);
  }

  if (current.request_counts.errored > 0) {
    console.warn(`⚠ ${current.request_counts.errored} requests errored. Will skip those groups.`);
  }

  // Collect ratings from results
  const ratings = {}; // id -> rating
  const errors = [];

  for await (const result of await client.messages.batches.results(batch.id)) {
    if (result.result.type !== "succeeded") {
      errors.push(result.custom_id);
      console.warn(`Skipping ${result.custom_id}: ${result.result.type}`);
      continue;
    }

    const textBlock = result.result.message.content.find((b) => b.type === "text");
    if (!textBlock) {
      errors.push(result.custom_id);
      continue;
    }

    // Extract JSON from response (strip markdown fences if present)
    const raw = textBlock.text.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`Could not parse JSON for ${result.custom_id}:\n${raw}`);
      errors.push(result.custom_id);
      continue;
    }

    for (const [idStr, rating] of Object.entries(parsed)) {
      const id = Number(idStr);
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 58 || r > 94) {
        console.warn(`Invalid rating ${r} for player ${id} — skipping.`);
        continue;
      }
      ratings[id] = r;
    }
  }

  console.log(`\nCollected ratings for ${Object.keys(ratings).length} / ${players.length} players.`);
  if (errors.length) console.warn(`Failed groups: ${errors.join(", ")}`);

  // Apply ratings and recalculate rarity
  let updated = 0;
  let rarityChanged = 0;

  for (const player of players) {
    const newRating = ratings[player.id];
    if (newRating === undefined) continue;

    const oldRating = player.rating;
    const oldRarity = player.rarity;
    const newRarity = getRarity(newRating);

    player.rating = newRating;
    player.rarity = newRarity;
    updated++;

    if (oldRarity !== newRarity) {
      console.log(`  ${player.name}: rating ${oldRating}→${newRating}, rarity ${oldRarity}→${newRarity}`);
      rarityChanged++;
    }
  }

  // Write back
  writeFileSync(playersPath, JSON.stringify(players, null, 2) + "\n");

  // Summary
  const counts = {};
  for (const p of players) counts[p.rarity] = (counts[p.rarity] || 0) + 1;

  console.log(`\n✓ Updated ${updated} players (${rarityChanged} rarity changes).`);
  console.log("Rarity breakdown:", counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
