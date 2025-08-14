import { getMapManifest } from "../info.js"
export async function getCordsFromTile(tile, {name, manifest } = {}) {
  manifest = manifest ?? await getMapManifest(name);
  if (!manifest || !manifest.map || typeof manifest.map.width !== 'number') {
    console.error('Invalid map manifest structure');
    return null;
  }

  const width = manifest.map.width;
  const x = tile % width;
  const y = Math.floor(tile / width);

  return { x, y };
}
export function deepCloneObj(obj) {
  // Handle primitive types and functions
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(item => deepCloneObj(item));
  }

  // Handle Map
  if (obj instanceof Map) {
    const cloneMap = new Map();
    for (const [key, value] of obj) {
      cloneMap.set(key, deepCloneObj(value));
    }
    return cloneMap;
  }

  // Handle Set
  if (obj instanceof Set) {
    const cloneSet = new Set();
    for (const value of obj) {
      cloneSet.add(deepCloneObj(value));
    }
    return cloneSet;
  }

  // Handle plain objects
  const clone = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepCloneObj(obj[key]);
    }
  }

  return clone;
}