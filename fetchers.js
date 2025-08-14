  import config from './config.js';
import { remoteVars, remoteJsonStore } from './remoteVarStore.js';

async function ensureActive() {
  remoteVars.info = remoteVars.info ?? {};
  remoteVars.info.games = remoteVars.info.games ?? {};
  remoteVars.info.games.active = remoteVars.info.games.active ?? {};
  remoteVars.info.games.active.ids = remoteVars.info.games.active.ids ?? new Set();
  remoteVars.info.games.active.ws = remoteVars.info.games.active.ws ?? new Map();
  await remoteJsonStore.save();
}

export async function findGameWebSocket(id, webSocketAmount = 20) {
  await ensureActive();
  const activeIDs = remoteVars.info.games.active.ids;
  const activeWS = remoteVars.info.games.active.ws;

  for (let i = 0; i < webSocketAmount; i++) {
    const response = await fetch(`https://${config.prefixs.use}${config.domain}/w${i}/api/game/${id}`);
    if (response.status === 200) {
      activeIDs.add(id);
      activeWS.set(id, i);
      await remoteJsonStore.save();
      return i;
    }
  }
  return null;
}

export async function findPublicLobby(webSocketAmount = 20) {
  let lobbies = await fetch(`https://${config.prefixs.use}${config.domain}/api/public_lobbies`);
  lobbies = await lobbies.json();
  lobbies = lobbies.lobbies;

  let output = new Map();

  await Promise.all(lobbies.map(async (lobby) => {
    const ws = await findGameWebSocket(lobby.gameID, webSocketAmount);
    output.set(lobby.gameID, { ...lobby, ws });
  }));

  return output;
}

export async function getPlayer(id) {
  const response = await fetch(`https://${config.prefixs.api}${config.domain}/player/${id}`);
  return response.json();
}

export async function getGame(id) {
  const response = await fetch(`https://${config.prefixs.api}${config.domain}/game/${id}`);
  return response;
}
