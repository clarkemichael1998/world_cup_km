import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playersPath = path.join(__dirname, "../data/players.json");

function getRarity(rating) {
  if (rating >= 93) return "icon";
  if (rating >= 86) return "legend";
  if (rating >= 78) return "epic";
  if (rating >= 70) return "rare";
  if (rating >= 58) return "common";
  return "clowns";
}

const players = JSON.parse(readFileSync(playersPath, "utf-8"));

let changed = 0;
for (const player of players) {
  const expected = getRarity(player.rating);
  if (player.rarity !== expected) {
    console.log(`${player.name} (${player.rating}): ${player.rarity} → ${expected}`);
    player.rarity = expected;
    changed++;
  }
}

writeFileSync(playersPath, JSON.stringify(players, null, 2) + "\n");
console.log(`\nDone. ${changed} player(s) updated.`);

// Print summary
const counts = {};
for (const p of players) counts[p.rarity] = (counts[p.rarity] || 0) + 1;
console.log("Rarity breakdown:", counts);
