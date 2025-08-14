import { getCordsFromTile } from '../util.js'
export function(intent, { name, manifest } = {}) {
  if ((intent.x ?? null) && (intent.y ?? null)) {
    intent.tile = {
      x: intent.x,
      y: intent.y
    }
  } else intent.tile = await getCordsFromTile( intent.tile, {name, manifest});
}