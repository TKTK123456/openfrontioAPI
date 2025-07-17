const kv = await Deno.openKv();
export async function findGameWebSocket(id, webSocketAmount = 20) {
  for (let i = 0; i < webSocketAmount; i++) {
    const response = await fetch(`https://blue.openfront.io/w${i}/api/game/${id}`);
    if (response.status === 200) {
      let output = await response.json()
      return output
    }
  }
}
export async function findPublicLobbyWebSocket(webSocketAmount = 20) {
  let lobbies = await fetch(`https://blue.openfront.io/api/public_lobbies`)
  lobbies = await lobbies.json()
  lobbies = lobbies.lobbies
  let output = []
  lobbies.forEach(async (lobby) => {
    kv.set(["games", "ids"], await kv.get(["games", "ids"]).value.add(id))
    output.push(findGameWebSocket(lobby.gameID, webSocketAmount))
  });
  output = await Promise.all(output)
  return output
}
export async function getPlayer(id) {
  let player = await fetch(`https://api.openfront.io/player/${id}`)
  player = await player.json()
  return player
}
export async function getGame(id) {
  let player = await fetch(`https://api.openfront.io/game/${id}`)
  player = await player.json()
  return player
}

