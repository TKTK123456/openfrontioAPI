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
export async function processAllIntents(
  turns,
  intentHandlers,
  batchSize = 50,
  { name, manifest, winnerIds = null } = {}
) {
  // Object to store results per type
  const resultsByType = {};

  for (let i = 0; i < turns.length; i += batchSize) {
    const batch = turns.slice(i, i + batchSize);

    // Process each batch of turns concurrently
    const batchResults = await Promise.all(
      batch.map(turn =>
        Promise.all(
          turn.intents.map(async intent => {
            if (!intentHandlers[intent.type]||!winnerCheck(winnerIds, intent.clientID)) return null; // skip unknown types
            const data = await intentHandlers[intent.type](intent, { name, manifest });
            if (!resultsByType[intent.type]) resultsByType[intent.type] = [];
            resultsByType[intent.type].push(data);
            return { type: intent.type, data};
          })
        )
      )
    );

    // Flatten and sort into type arrays
  }

  return resultsByType;
}
export function winnerCheck(winnerIds, clientId) {
  if (!winnerIds) return true;
  return winnerIds.includes(clientId)
}