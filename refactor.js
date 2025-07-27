import { createClient } from '@supabase/supabase-js';
import config from './config.js';

const supabase = createClient("https://ebnqhovfhgfrfxzexdxj.supabase.co", process.env.SUPABASE_TOKEN);

const folder = "logs";
const concurrencyLimit = 10;

const datesToFix = [
  "2025-07-20",
  "2025-07-21",
  "2025-07-22",
  "2025-07-23",
  "2025-07-24",
  "2025-07-25",
  "2025-07-26",
];

async function loadFile(dateStr) {
  const filename = `${dateStr}.ndjson`;
  const { data, error } = await supabase.storage.from(folder).download(filename);
  if (error) {
    console.error(`Failed to download ${filename}:`, error);
    return null;
  }
  const text = await data.text();
  return text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
}

async function saveFile(dateStr, entries) {
  const filename = `${dateStr}.ndjson`;
  const content = entries.map(e => JSON.stringify(e)).join("\n");
  const { error } = await supabase.storage.from(folder).upload(filename, new Blob([content]), {
    upsert: true,
    contentType: "application/x-ndjson",
  });
  if (error) {
    console.error(`Failed to upload ${filename}:`, error);
  }
}

async function fetchMapType(gameId) {
  try {
    const response = await fetch(`https://${config.prefixs.use}${config.domain}/api/game/${gameId}`);
    if (!response.ok) {
      console.warn(`Failed to fetch game ${gameId}: ${response.statusText}`);
      return "unknown";
    }
    const game = await response.json();
    return game?.info?.config?.gameMap || "unknown";
  } catch (e) {
    console.error(`Error fetching game ${gameId}:`, e);
    return "unknown";
  }
}

// Utility to run async functions with concurrency limit
async function runWithConcurrencyLimit(items, workerFn, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await workerFn(items[currentIndex]);
    }
  }

  const workers = [];
  for (let i = 0; i < limit; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function fixOldFiles() {
  for (const dateStr of datesToFix) {
    console.log(`Processing ${dateStr}...`);
    const entries = await loadFile(dateStr);
    if (!entries) continue;

    if (entries.length) {
      const updatedEntries = await runWithConcurrencyLimit(entries, async (gameId) => {
        const mapType = await fetchMapType(gameId);
        console.log(`Game ${gameId}: mapType = ${mapType}`);
        return { gameId, mapType };
      }, concurrencyLimit);
      await saveFile(dateStr, updatedEntries);
      console.log(`Updated ${dateStr}.ndjson with mapType`);
    } else {
      console.log(`${dateStr}.ndjson already updated or empty.`);
    }
  }
}

fixOldFiles().then(() => console.log("Done."));
