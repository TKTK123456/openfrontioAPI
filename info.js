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
})()) {
  date = date.toISOString().split("T")[0].split("-").join("");
  const url = `https://ofstats.fra1.digitaloceanspaces.com/games/openfront-${date}.tar.bz2`;

  // Fetch the .tar.bz2 file
  const response = await fetch(url);
  const compressedData = new Uint8Array(await response.arrayBuffer());

  // Decompress the .bz2
  const tarBuffer = Bunzip.decode(compressedData); // returns Uint8Array

  // Extract the .tar
  const extract = tar.extract();
  const entries = [];

  // Handle each file in the tar (assuming one JSON file inside)
  extract.on('entry', (header, stream, next) => {
    let data = '';
    stream.on('data', (chunk) => {
      data += chunk.toString('utf8');
    });
    stream.on('end', () => {
      entries.push({
        name: header.name,
        content: data,
      });
      next(); // move to next entry
    });
    stream.resume(); // drain the stream
  });

  await new Promise((resolve, reject) => {
    extract.on('finish', resolve);
    extract.on('error', reject);

    // Create a readable stream from the tarBuffer
    const stream = Readable.from(Buffer.from(tarBuffer));
    stream.pipe(extract);
  });

  // Assuming there's only one JSON file
  const jsonEntry = entries.find(e => e.name.endsWith('.json'));
  if (!jsonEntry) throw new Error("No JSON file found in archive");

  const jsonData = JSON.parse(jsonEntry.content);
  return jsonData;
}
getDataDump().then(console.log)
