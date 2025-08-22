export const info = { requiredIntents: ["spawn"], dataTypes: ["heatmap", "avrg"] }

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
export async function basicHandler(intents) {
  intents = intents[0]
  
}