/**
 * import-ratings.mjs
 * Reads data/ratings.csv and applies any changed ratings back to players.json,
 * then recalculates rarity automatically.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playersPath = path.join(__dirname, "../data/players.json");
const csvPath = path.join(__dirname, "../data/ratings.csv");

function getRarity(rating) {
  if (rating >= 93) return "icon";
  if (rating >= 86) return "legend";
  if (rating >= 78) return "epic";
  if (rating >= 70) return "rare";
  if (rating >= 58) return "common";
  return "clowns";
}

// Parse CSV (handles quoted fields)
function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const fields = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { fields.push(cur); cur = ""; }
      else { cur += ch; }
    }
    fields.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, (fields[i] ?? "").trim()]));
  });
}

const csv = readFileSync(csvPath, "utf-8");
const rows = parseCsv(csv);

// Build lookup: id -> new rating
const newRatings = {};
for (const row of rows) {
  const id = Number(row.id);
  const rating = Number(row.rating);
  if (!id || isNaN(rating) || rating < 1 || rating > 99) {
    console.warn(`Skipping invalid row: id=${row.id} rating=${row.rating}`);
    continue;
  }
  newRatings[id] = rating;
}

const players = JSON.parse(readFileSync(playersPath, "utf-8"));

let changed = 0;
let rarityChanged = 0;

for (const player of players) {
  const newRating = newRatings[player.id];
  if (newRating === undefined || newRating === player.rating) continue;

  const oldRarity = player.rarity;
  const newRarity = getRarity(newRating);

  console.log(
    `${player.name}: ${player.rating}→${newRating}` +
    (oldRarity !== newRarity ? ` (${oldRarity}→${newRarity})` : "")
  );

  player.rating = newRating;
  player.rarity = newRarity;
  changed++;
  if (oldRarity !== newRarity) rarityChanged++;
}

writeFileSync(playersPath, JSON.stringify(players, null, 2) + "\n");

const counts = {};
for (const p of players) counts[p.rarity] = (counts[p.rarity] || 0) + 1;

console.log(`\n✓ Updated ${changed} players (${rarityChanged} rarity changes).`);
console.log("Rarity breakdown:", counts);
