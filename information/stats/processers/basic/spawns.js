export const info = { requiredIntent: "spawn", dataTypes: ["heatmap", "avrg"] }

export async function heatmapHandler(intents, heatmap = []) {
  intents = intents[0]
  for (const intent of intents) {
    heatmap.push(intent.tile)
  }
  return heatmap
}
export async function avrgHandler(intents, avrg = []) {
  intents = intents[0]
  for (const intent of intents) {
    avrg.push(intent.tile)
  }
  return avrg
}
export async function handler(intents) {
  intents = intents[0]
  const results = new Map()
  for (const intent of intents) {
    results.set(intent.clientID, intent)
  }
  return results.values().toArray()
}