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
 * Load a grayscale map.bin image and overlay heatmap on top.
 * @param {string} mapName - OpenFront.io map name (e.g. "World", "Italia")
 * @param {Array<{x:number,y:number,value?:number}>} points - Heatmap points
 * @param {object} [options]
 *        radius: number - radius of heat point (default 20)
 * @returns {{ width: number, height: number, raw: Uint8ClampedArray }}
 */
export async function generateHeatmapWithMapBackgroundRaw(mapName, points, options = {}) {
  const radius = options.radius ?? 20;
  const base = `https://cdn.jsdelivr.net/gh/openfrontio/OpenFrontIO/resources/maps/${mapName.toLowerCase()}`;

  // Get manifest (for width/height)
  const manifest = await fetch(`${base}/manifest.json`).then(r => r.json());
  const { width, height } = manifest;

  // Fetch grayscale map.bin data
  const gray = new Uint8Array(await fetch(`${base}/map.bin`).then(r => r.arrayBuffer()));
  if (gray.length !== width * height) throw new Error("map.bin size mismatch");

  // Create RGBA buffer from grayscale
  const background = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    const j = i * 4;
    background[j] = v;
    background[j + 1] = v;
    background[j + 2] = v;
    background[j + 3] = 255;
  }

  // Generate heatmap buffer using your function
  const heatmap = generateHeatmapRaw(width, height, points, { radius });

  // Composite heatmap onto background with alpha blending
  for (let i = 0; i < heatmap.length; i += 4) {
    const hr = heatmap[i];
    const hg = heatmap[i + 1];
    const hb = heatmap[i + 2];
    const ha = heatmap[i + 3] / 255;

    const br = background[i];
    const bg = background[i + 1];
    const bb = background[i + 2];

    background[i]     = Math.round(hr * ha + br * (1 - ha));
    background[i + 1] = Math.round(hg * ha + bg * (1 - ha));
    background[i + 2] = Math.round(hb * ha + bb * (1 - ha));
    // keep alpha = 255
  }

  return {
    width,
    height,
    raw: background,
  };
}
