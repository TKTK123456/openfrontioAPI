import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
const kv = await Deno.openKv();
export const setHelpers = {
  add: async function(key, value) {
    let fullSet = await this.getSet(key)
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
    output = output.value
    if (!output) {
      output = new Map();
    }
    return output;
  },
  get: async function(key, mapKey) {
    let fullMap = await this.getMap(key)
    return fullMap.get(mapKey)
  }
}
async function updateGameInfo(auto) {
  await findPublicLobbyWebSocket()
  let active = {
    ids: (async () => {let out = await setHelpers.getSet(["info", "games", "active", "ids"]);return out;})(),
    ws: (async () => {let out = await setHelpers.getMap(["info", "games", "active", "ws"]);return out;})()
  }
  console.log(active.ids)
  for (let i = 0;i<active.ids.length;i++) {
    let currentId = active.ids.values().next()
    let isArchived = await fetch(`https://blue.openfront.io/api/w${active.ws.get(currentId)}/archived_game/${currentId}`)
    isArchived = await isArchived.json();
    isArchived = isArchived.exists
    if (isArchived) {
      
    }
  }
}
findPublicLobby().then(console.log)
