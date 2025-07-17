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
  lobbies.forEach((lobby) => {
    output.push(findGameWebSocket(lobby.gameID, webSocketAmount))
  });
  output = await Promise.all(output)
  return output
}

