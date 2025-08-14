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