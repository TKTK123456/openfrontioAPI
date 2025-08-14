import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js';
import config from './config.js';
import { createClient } from '@supabase/supabase-js';
import fetchFPGameIds from './fetchFrontPlusDump.js';
import { remoteVars, remoteJsonStore } from './remoteVarStore.js';

const supabase = createClient("https://ebnqhovfhgfrfxzexdxj.supabase.co", process.env.SUPABASE_TOKEN);

let defaultClientsToTime = parseInt(await remoteVars.clientsToTime ?? 571.428571429);
let clientsToTime = [defaultClientsToTime];

async function getAvrgTimeRaito(currentClientsToTime = false) {
  if (currentClientsToTime) clientsToTime.push(...currentClientsToTime);
  if (clientsToTime.length < 2) return (currentClientsToTime ? Math.min(...currentClientsToTime) : defaultClientsToTime);

  let totalTime = clientsToTime.reduce((acc, val) => acc + val, 0);
  let avrgTime = totalTime / clientsToTime.length;
  defaultClientsToTime = avrgTime;

  remoteVars.clientsToTime = defaultClientsToTime;
  await remoteJsonStore.save();

  return avrgTime;
}

let updatingGameInfo = false;

export async function updateGameInfo(autoSetNextRun = true, { type = "auto", log = true, autoSetNextRunType = type } = {}) {

  const logger = msg => { if (log) console.log(msg); };

  async function loadOrCreateFile(dateStr) {
    const filename = `${dateStr}.json`;
    const folder = "logs";

    const { data: list, error: listErr } = await supabase.storage.from(folder).list("", { search: filename });
    if (listErr) throw new Error(`Failed to list files: ${listErr.message}`);

    const fileExists = list.some(f => f.name === filename);
    if (!fileExists) {
      const { error } = await supabase.storage.from(folder).upload(filename, new Blob([""]), { upsert: true });
      if (error) console.error(error);
    }

    const { data, error } = await supabase.storage.from(folder).download(filename);
    if (error) throw new Error(`Failed to download ${filename}: ${JSON.stringify(error)}`);

    const text = await data.text();
    return text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
  }

  async function saveFile(dateStr, entries) {
    const filename = `${dateStr}.json`;
    const content = JSON.stringify(entries.flat(Infinity));
    const { error } = await supabase.storage.from("logs").upload(filename, new Blob([content]), { upsert: true });
    if (error) console.error(`Error uploading log file ${filename}:`, error);
  }

  try {
    let startTime = Date.now();
    let publicLobbies = await findPublicLobby();
    publicLobbies = Array.from(publicLobbies.values());

    if (updatingGameInfo) {
      let timeTaken = Date.now() - startTime;
      let timePerClient = await getAvrgTimeRaito(publicLobbies.map(lobby => {
        const timeRemaining = 60000 - lobby.msUntilStart;
        if (lobby.numClients === 0 || timeRemaining <= 0) return defaultClientsToTime;
        return timeRemaining / lobby.numClients;
      }));

      let lobbiesTimesToStart = publicLobbies.map(lobby => [
        lobby.msUntilStart,
        (lobby.gameConfig.maxPlayers - lobby.numClients) * timePerClient
      ]).flat().map(t => t - timeTaken > 0 ? t - timeTaken : 500);

      const waitTime = Math.min(...lobbiesTimesToStart);
      if (autoSetNextRun) {
        logger(`Already active, trying again in ${waitTime}ms`);
        await new Promise(() => setTimeout(updateGameInfo, waitTime));
      } else {
        logger(`Suggesting to try again in ${waitTime}ms`);
      }
      return waitTime;
    }

    updatingGameInfo = true;
    logger(`Updating gameIDs`);

    const activeIDs = remoteVars.info?.games?.active?.ids ?? new Set();
    const activeWS = remoteVars.info?.games?.active?.ws ?? new Map();

    const dateToNewEntries = new Map();

    for (const currentId of activeIDs.values()) {
      const wsValue = activeWS.get(currentId);
      if (!wsValue) continue;

      const res = await getGame(currentId);
      const gameRecord = await res.json();

      if (!gameRecord?.error) {
        const endDateRaw = gameRecord?.info?.end;
        if (!endDateRaw) {
          console.warn(`Missing end date for archived game ${currentId}`);
          activeWS.delete(currentId);
          activeIDs.delete(currentId);
          continue;
        }

        const endDate = new Date(endDateRaw);
        if (isNaN(endDate.getTime())) {
          console.warn(`Invalid end date for archived game ${currentId}: ${endDateRaw}`);
          continue;
        }

        const dateStr = endDate.toISOString().slice(0, 10);
        const mapType = gameRecord?.info?.config?.gameMap ?? "unknown";

        if (!dateToNewEntries.has(dateStr)) dateToNewEntries.set(dateStr, []);
        dateToNewEntries.get(dateStr).push({ gameId: currentId, mapType });

        activeWS.delete(currentId);
        activeIDs.delete(currentId);

      } else {
        // fallback fetch
        let game = await fetch(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/game/${currentId}`);
        game = await game.json();
        if (game.error === "Game not found") {
          activeWS.delete(currentId);
          activeIDs.delete(currentId);
        }
      }
    }

    // Update remoteVars
    remoteVars.info = remoteVars.info ?? {};
    remoteVars.info.games = remoteVars.info.games ?? {};
    remoteVars.info.games.active = remoteVars.info.games.active ?? {};
    remoteVars.info.games.active.ids = activeIDs;
    remoteVars.info.games.active.ws = activeWS;

    for (const [dateStr, newEntries] of dateToNewEntries.entries()) {
      let existingEntries = await loadOrCreateFile(dateStr);
      existingEntries.push(...newEntries.flat(Infinity));
      existingEntries = Array.from(new Set(existingEntries.flat(Infinity).map(i => JSON.stringify(i)))).map(i => JSON.parse(i));
      logger(`Adding ${newEntries.length} games with mapType to ${dateStr}.json`);
      await saveFile(dateStr, existingEntries);
    }

    await remoteJsonStore.save();

    let timeTaken = Date.now() - startTime;
    let timePerClient = await getAvrgTimeRaito(publicLobbies.map(lobby => {
      const timeRemaining = 60000 - lobby.msUntilStart;
      if (lobby.numClients === 0 || timeRemaining <= 0) return defaultClientsToTime;
      return timeRemaining / lobby.numClients;
    }));

    let lobbiesTimesToStart = publicLobbies.map(lobby => [
      lobby.msUntilStart,
      (lobby.gameConfig.maxPlayers - lobby.numClients) * timePerClient
    ]).flat().map(t => t - timeTaken > 0 ? t - timeTaken : 500);

    const waitTime = Math.min(...lobbiesTimesToStart);

    updatingGameInfo = false;

    if (autoSetNextRun) {
      logger(`Running again in ${waitTime}ms`);
      setTimeout(updateGameInfo, waitTime, false, { type: autoSetNextRunType });
    } else {
      logger(`Suggested wait ${waitTime}ms`);
    }

    return waitTime;

  } catch (error) {
    console.error(error);
    updatingGameInfo = false;
  }
}

// Start auto-update
await updateGameInfo(true);

// Deno server
Deno.serve(() => new Response("Hello, world!"));

// Example cron placeholder
Deno.cron("Fetch front plus game ids", "*/30 * * * *", () => {
  updateGameInfo(true);
});