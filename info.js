import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import Bunzip from 'seek-bzip';
import tar from 'tar-stream';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
const kv = await Deno.openKv();
export const setHelpers = {
  add: async function(key, value) {
    let fullSet = await this.getSet(key)
    if (fullSet.has(value)) return
    fullSet.add(value);
    kv.set(key, fullSet);
  },
  getSet: async function(key) {
    let output = await kv.get(key);
    output = output.value
    if (!output) {
      output = new Set();
    }
    return output;
  },
  delete: async function(key, setKey) {
    let fullSet = await this.getSet(key)
    fullSet.delete(setKey);
    kv.set(key, fullSet);
  }
}
export const mapHelpers = {
  set: async function(key, mapKey, value) {
    let fullMap = await this.getMap(key)
    if (fullMap.has(mapKey)) return
    fullMap.set(mapKey, value)
    kv.set(key, fullMap)
  },
  getMap: async function(key) {
    let output = await kv.get(key);
    output = output.value
    if (!output) {
      output = new Map();
    }
    return output;
  },
  get: async function(key, mapKey) {
    let fullMap = await this.getMap(key)
    return fullMap.get(mapKey)
  },
  delete: async function(key, mapKey) {
    let fullMap = await this.getMap(key)
    fullMap.delete(mapKey);
    kv.set(key, fullMap);
  }
}
async function updateGameInfo(auto) {
  await findPublicLobby()
  let active = {
    ids: (async () => {let out = await setHelpers.getSet(["info", "games", "active", "ids"]);return out;})(),
    ws: (async () => {let out = await setHelpers.getMap(["info", "games", "active", "ws"]);return out;})()
  }
  for (let i = 0;i<active.ids.length;i++) {
    let currentId = active.ids.values().next()
    let archived = await fetch(`https://blue.openfront.io/api/w${active.ws.get(currentId)}/archived_game/${currentId}`)
    archived = await archived.json();
    if (archived.exists) {
      await setHelpers.add(["info", "games", "ids"], currentId)
      await mapHelpers.delete(["info", "games", "active", "ws"], currentId)
      await setHelpers.delete(["info", "games", "active", "ids"], currentId)
    }
  }
}
async function getDataDump(date = (() => {
  let date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date;
})(), cantFetchTryPrevDay = true) {
  try {
  let prevDate = date
  date = date.toISOString().split("T")[0].split("-").join("");
  console.log(date)
  const url = `https://ofstats.fra1.digitaloceanspaces.com/games/openfront-${date}.tar.bz2`;

  const response = await fetch(url);

  // Step 1: check response
  if (!response.ok) {
    if (cantFetchTryPrevDay) {
      date = prevDate
      date.setUTCDate(date.getUTCDate() - 1);
      let out = await getDataDump(date, false);
      return out
    }
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const buffer = new Uint8Array(await response.arrayBuffer());

  // Step 2: check the magic bytes
  const magic = buffer.slice(0, 2);
  if (magic[0] !== 0x42 || magic[1] !== 0x5A) {
    // 0x42 = 'B', 0x5A = 'Z'
    console.error("Magic bytes:", buffer.slice(0, 10));
    throw new Error("Not a valid bzip2 file");
  }

  // Step 3: decompress .bz2 to get .tar
  const tarBuffer = Bunzip.decode(buffer);

  // Step 4: extract the .tar contents
  const extract = tar.extract();
  const entries = [];

  extract.on('entry', (header, stream, next) => {
    let chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => {
      entries.push({
        name: header.name,
        content: Buffer.concat(chunks).toString('utf8'),
      });
      next();
    });
    stream.resume();
  });

  await new Promise((resolve, reject) => {
    extract.on('finish', resolve);
    extract.on('error', reject);

    const stream = Readable.from(Buffer.from(tarBuffer));
    stream.pipe(extract);
  });

  const jsonEntry = entries.find(e => e.name.endsWith('.json'));
  if (!jsonEntry) throw new Error("No .json file found in the tar archive");

  const jsonData = JSON.parse(jsonEntry.content);
  return jsonData;
  } catch(e) {
    console.log(e)
  }
}
getDataDump().then(console.log)
