import { getMapManifest } from "./info.js";
/**
 * Generate heatmap raw RGBA buffer (Uint8ClampedArray)
 * @param {number} width - image width
 * @param {number} height - image height
 * @param {Array<{x:number,y:number,value?:number}>} points - points with optional intensity (0..1)
 * @param {object} [options]
 *        radius: number - radius of heat point (default 20)
 * @returns {Uint8ClampedArray} - length = width * height * 4, RGBA pixels
 */
export function generateHeatmapRaw(width, height, points, options = {}) {
  const radius = options.radius ?? 20;
  const radiusSq = radius * radius;

  // Create alpha heat buffer (float array for accumulation)
  const heatAlpha = new Float32Array(width * height);

  // For each point, accumulate heat with a radial falloff
  for (const { x, y, value = 1 } of points) {
    const xStart = Math.max(0, Math.floor(x - radius));
    const xEnd = Math.min(width - 1, Math.ceil(x + radius));
    const yStart = Math.max(0, Math.floor(y - radius));
    const yEnd = Math.min(height - 1, Math.ceil(y + radius));

    for (let py = yStart; py <= yEnd; py++) {
      for (let px = xStart; px <= xEnd; px++) {
        const dx = px - x;
        const dy = py - y;
        const distSq = dx * dx + dy * dy;
        if (distSq > radiusSq) continue;

        // Simple linear falloff: 1 at center, 0 at radius edge
        const intensity = value * (1 - distSq / radiusSq);

        // Accumulate max heat
        const idx = py * width + px;
        heatAlpha[idx] = Math.min(1, heatAlpha[idx] + intensity);
      }
    }
  }

  // Create RGBA buffer to output
  const buffer = new Uint8ClampedArray(width * height * 4);

  // Color gradient stops (0 to 1)
  // Feel free to customize these stops (RGBA arrays)
  const gradient = [
    { stop: 0, color: [0, 0, 255, 0] },      // transparent blue
    { stop: 0.3, color: [0, 0, 255, 255] },  // blue
    { stop: 0.5, color: [0, 255, 255, 255] },// cyan
    { stop: 0.7, color: [0, 255, 0, 255] },  // lime
    { stop: 1, color: [255, 0, 0, 255] },    // red
  ];

  // Helper to interpolate colors
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function interpolateColor(t) {
    // Clamp t to [0,1]
    t = Math.max(0, Math.min(1, t));

    // Find stops between which t lies
    let start = gradient[0];
    let end = gradient[gradient.length - 1];
    for (let i = 0; i < gradient.length - 1; i++) {
      if (t >= gradient[i].stop && t <= gradient[i + 1].stop) {
        start = gradient[i];
        end = gradient[i + 1];
        break;
      }
    }
    // Normalize t between stops
    const localT = (t - start.stop) / (end.stop - start.stop);

    // Interpolate each channel
    const r = Math.round(lerp(start.color[0], end.color[0], localT));
    const g = Math.round(lerp(start.color[1], end.color[1], localT));
    const b = Math.round(lerp(start.color[2], end.color[2], localT));
    const a = Math.round(lerp(start.color[3], end.color[3], localT));

    return [r, g, b, a];
  }

  // Map heat alpha to RGBA colors
  for (let i = 0; i < width * height; i++) {
    const alpha = heatAlpha[i];
    const [r, g, b, a] = interpolateColor(alpha);

    const idx = i * 4;
    buffer[idx] = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = a;
  }

  return buffer;
}
/**
 * Load grayscale map.bin and overlay heatmap.
 * @param {string} mapName - OpenFront.io map name (e.g. "World", "Italia")
 * @param {Array<{x:number,y:number,value?:number}>} points - Heatmap points
 * @param {object} [options]
 *        radius: number - radius of heat point (default 20)
 * @returns {{ width: number, height: number, raw: Uint8ClampedArray }}
 */
export async function generateHeatmapWithMapBackgroundRaw(mapName, points, options = {}) {
  const radius = options.radius ?? 3;
  const base = `https://cdn.jsdelivr.net/gh/openfrontio/OpenFrontIO/resources/maps/${mapName.toLowerCase()}`;

  // Get manifest from local or remote (must return map: { width, height })
  const manifest = await getMapManifest(mapName);
  const { width, height } = manifest.map;

  // Fetch grayscale image
  const gray = new Uint8Array(await fetch(`${base}/map.bin`).then(r => r.arrayBuffer()));
  if (gray.length !== width * height) {
    throw new Error(`map.bin size mismatch: expected ${width * height}, got ${gray.length}`);
  }

  // Grayscale to RGBA buffer
  const background = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    const j = i * 4;
    background[j] = v;
    background[j + 1] = v;
    background[j + 2] = v;
    background[j + 3] = 255;
  }

  // Generate heatmap
  const heatmap = generateHeatmapRaw(width, height, points, { radius });

  // Composite with alpha blending
  for (let i = 0; i < heatmap.length; i += 4) {
    const ha = heatmap[i + 3] / 255;
    if (ha === 0) continue;

    const j = i;
    const hr = heatmap[j];
    const hg = heatmap[j + 1];
    const hb = heatmap[j + 2];

    const br = background[j];
    const bg = background[j + 1];
    const bb = background[j + 2];

    background[j]     = Math.round(hr * ha + br * (1 - ha));
    background[j + 1] = Math.round(hg * ha + bg * (1 - ha));
    background[j + 2] = Math.round(hb * ha + bb * (1 - ha));
  }

  return {
    width,
    height,
    raw: background,
  };
}
