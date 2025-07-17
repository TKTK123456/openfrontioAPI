import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import Bunzip from 'seek-bzip'
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
async function getDataDump(date = (()=>{
  let date = new Date();
  date.setUTCDate(date.getUTCDate()-1)
  return date
})()) {
  date = date.toISOString().split("T")[0].split("-").join("")
  let compressedData = await fetch(`https://ofstats.fra1.digitaloceanspaces.com/games/openfront-${date}.tar.bz2`)
  compressedData = await compressedData.buffer()
  const decompressedData = Bunzip.decode(compressedData)
  const jsonString = decompressedData.toString('utf8');
  const jsonData = JSON.parse(jsonString);
  console.log(jsonData)
  return jsonData
}
getDataDump()
