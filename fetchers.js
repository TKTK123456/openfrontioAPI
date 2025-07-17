const kv = await Deno.openKv();
//kv.set(["info", "games", "active", "ids"], new Set())
//kv.set(["info", "games", "active", "wsNum"], new Set())
export async function findGameWebSocket(id, webSocketAmount = 20) {
  for (let i = 0; i < webSocketAmount; i++) {
    const response = await fetch(`https://blue.openfront.io/w${i}/api/game/${id}`);
    if (response.status === 200) {
      return i
    }
  }
}
export async function findPublicLobbyWebSocket(webSocketAmount = 20) {
  let lobbies = await fetch(`https://blue.openfront.io/api/public_lobbies`)
  lobbies = await lobbies.json()
  lobbies = lobbies.lobbies
  let output = []
  await lobbies.forEach(async (lobby) => {
    let currentIDs = await kv.get(["info", "games", "active", "ids"])
    currentIDs = currentIDs.value
    currentIDs.add(lobby.gameID)
    kv.set(["info", "games", "active", "ids"], currentIDs)
    let wsNum = await findGameWebSocket(lobby.gameID, webSocketAmount)
    currentIDs = await kv.get(["info", "games", "active", "wsNum"])
    currentIDs = currentIDs.value
    currentIDs.add(wsNum)
    kv.set(["info", "games", "active", "wsNum"], currentIDs)
    output.push(wsNum)
  });
  return output
}
export async function getPlayer(id) {
  let player = await fetch(`https://api.openfront.io/player/${id}`)
  return player
}
export async function getGame(id) {
  let player = await fetch(`https://api.openfront.io/game/${id}`)
  return player
}

