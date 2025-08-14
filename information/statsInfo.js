import path from 'path'

async function importIntentHandlers(folderPath = "./stats/intents") {
  const handlers = {};

  // Read all files in the folder
  for await (const entry of Deno.readDir(folderPath)) {
    if (entry.isFile && entry.name.endsWith(".js")) {
      const modulePath = path.join(folderPath, entry.name);

      // Dynamically import
      const mod = await import(modulePath);

      // Remove extension from filename for the key
      const key = path.basename(entry.name, ".js");

      // Assign default export
      handlers[key] = mod.default;
    }
  }

  return handlers;
}
export const intentHandlers = await importIntentHandlers()
/**
 * Efficiently process all intents across multiple turns.
 * @param {Array} turns - Array of turns, each with a `.intents` array
 * @param {Function} processIntentFn - Async function to process a single intent
 * @param {number} batchSize - Optional, number of turns to process concurrently
 * @returns {Promise<Array>} - Array of all processed intents
 */
export async function processAllIntents(turns, processIntentFn, batchSize = 50, {name, manifest, types = []} = {}) {
  const results = [];

  for (let i = 0; i < turns.length; i += batchSize) {
    const batch = turns.slice(i, i + batchSize);

    // Process each batch of turns concurrently
    const batchResults = await Promise.all(
      batch.map(turn =>
        // Process all intents in the turn concurrently
        Promise.all(turn.intents.map(intent => intentHandlers[intent.type](intent, {name, manifest})))
      )
    );

    // Flatten and collect results
    results.push(...batchResults.flat());
  }

  return results;
}
