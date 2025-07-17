import { findGameWebSocket, findPublicLobbyWebSocket, getPlayer, getGame } from './fetchers.js'
const kv = await Deno.openKv();
export const setHelpers = {
  add: async function(key, value) {
    let fullSet = await this.getSet(key)
    fullSet.add(value);
    kv.set(key, fullSet);
  },
  getSet: async function(key) {
    let output = await kv.get(key);
    if (!output) {
      output = new Set();
    }
    return output.value;
  }
}
export const mapHelpers = {
  set: async function(key, mapKey, value) {
    let fullMap = await this.getMap(key)
    fullMap.set(mapKey, value)
    kv.set(key, fullMap)
  },
  getMap: async function(key) {
    let output = await kv.get(key);
    if (!output) {
      output = new Map();
    }
    return output.value;
  },
  get: async function(key, mapKey) {
    let fullMap = await this.getMap(key)
    return fullMap.get(mapKey)
  }
}
async function updateGameInfo() {
  await findPublicLobbyWebSocket()
  let active = {
    ids: (async () => {let out = await setHelpers.getSet(["info", "games", "active", "ids"]);return out;})(),
    ws: (async () => {let out = await setHelpers.getMap(["info", "games", "active", "ws"]);return out;})()
  }
  for (let i = 0;i<active.ids.length;i++) {
    
  }
}
