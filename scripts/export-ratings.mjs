/**
 * export-ratings.mjs
 * Exports players to ratings.csv sorted by rating descending.
 * Open in Excel, edit the rating column, save as CSV, then run import-ratings.mjs.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playersPath = path.join(__dirname, "../data/players.json");
const csvPath = path.join(__dirname, "../data/ratings.csv");

const players = JSON.parse(readFileSync(playersPath, "utf-8"));
players.sort((a, b) => b.rating - a.rating);

const rows = [["id", "name", "nation", "pos", "club", "rating", "rarity"]];
for (const p of players) {
  rows.push([p.id, p.name, p.nation, p.pos, p.club, p.rating, p.rarity]);
}

const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
writeFileSync(csvPath, csv);
console.log(`Exported ${players.length} players to data/ratings.csv`);
console.log("Open in Excel, edit the 'rating' column only, save as CSV, then run:");
console.log("  node scripts/import-ratings.mjs");
