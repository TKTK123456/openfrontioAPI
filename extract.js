import Bunzip from 'seek-bzip';
import tar from 'tar-stream';
import fs from 'fs/promises';
import { Readable } from 'stream';

async function run() {
  // Read date from env or default to yesterday
  let dateStr = process.env.DATE;
  if (!dateStr) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  
  const url = `https://ofstats.fra1.digitaloceanspaces.com/games/openfront-${dateStr}.tar.bz2`;
  console.log("Downloading:", url);

  const response = await fetch(url);
  if (!response.ok) {
    console.error("Failed to download file:", response.status);
    process.exit(1);
  }

  const compressed = new Uint8Array(await response.arrayBuffer());

  console.log("Decompressing bzip2...");
  const tarBuffer = Bunzip.decode(compressed);

  const extract = tar.extract();

  extract.on('entry', async (header, stream, next) => {
    let chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', async () => {
      const fileBuffer = Buffer.concat(chunks);

      // Write JSON files to disk (creating 'json' folder)
      await fs.mkdir('json', { recursive: true });

      const filepath = `json/${header.name}`;
      await fs.writeFile(filepath, fileBuffer);
      console.log("Extracted:", filepath);

      next();
    });
    stream.resume();
  });

  await new Promise((resolve, reject) => {
    extract.on('finish', resolve);
    extract.on('error', reject);

    Readable.from(tarBuffer).pipe(extract);
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
