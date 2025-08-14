import { getCordsFromTile, deepCloneObj } from '../util.js';

export async function processIntent(intent, { name, manifest } = {}) {

  // If intent has x and y coordinates, set tile
  if ((intent.x ?? null) !== null && (intent.y ?? null) !== null) {
    intent.tile = {
      x: intent.x,
      y: intent.y
    };
  } else {
    // Otherwise, get coordinates from tile asynchronously
    intent.tile = await getCordsFromTile(intent.tile, { name, manifest });
  }
  
  const setSpawn = { 
    clientId: intent.clientID,
    intent: deepCloneObj(intent)
  }
}
