import { setHelpers, mapHelpers } from './info.js'
import config from './config.js'
const kv = await Deno.openKv();
//kv.delete(["info", "games", "active", "ws"])

export async function findGameWebSocket(id, webSocketAmount = 20) {
  for (let i = 0; i < webSocketAmount; i++) {
    const response = await fetch(`https://${config.prefixs.use}${config.domain}/w${i}/api/game/${id}`);
    if (response.status === 200) {
      setHelpers.add(["info", "games", "active", "ids"], id)
      mapHelpers.set(["info", "games", "active", "ws"], id, i)
      return i
    }
  }
}
export async function findPublicLobby(webSocketAmount = 20) {
  let lobbies = await fetch(`https://${config.prefixs.use}${config.domain}/api/public_lobbies`)
  lobbies = await lobbies.json()
  lobbies = lobbies.lobbies
  let output = new Map()
  await Promise.all(lobbies.map(async (lobby) => {
    output.set(lobby.gameID, {...lobby, ws: await findGameWebSocket(lobby.gameID, webSocketAmount)})
  }));
  return output
}
export async function getPlayer(id) {
  let player = await fetch(`https://${config.prefixs.api}${config.domain}/player/${id}`)
  return player
}
export async function getGame(id) {
  let game = await fetch(`https://${config.prefixs.api}${config.domain}/game/${id}`)
  return game
}
