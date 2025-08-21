import { getCordsFromTile, deepCloneObj } from '../util.js';

export default async function processIntent(intent, { name, manifest } = {}) {
  if (intent.x != null && intent.y != null) {
    intent.tile = { x: intent.x, y: intent.y };
  } else {
    intent.tile = await getCordsFromTile(intent.tile, { name, manifest });
  }

  if (!intent.tile) return {};

  return deepCloneObj(intent)
}
