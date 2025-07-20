import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import Bunzip from 'seek-bzip';
import tar from 'tar-stream';
import { Buffer } from 'node:buffer'; 
import { Readable } from 'node:stream';
import config from './config.js'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient("https://ebnqhovfhgfrfxzexdxj.supabase.co", process.env.SUPABASE_TOKEN)
const kv = await Deno.openKv();
kv.delete(["number", "amountRuns"], 0)
kv.delete(["number", "startTime"], Date.now())
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
    if (!fullSet.has(setKey)) return
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
    if (!fullMap.has(mapKey)) return;
    fullMap.delete(mapKey);
    kv.set(key, fullMap);
  }
}
let previousStartTimes = []
let maxPreviousStartTimesLength = 5
function getHuristicTime() {
  if (previousStartTimes.length<2) return 10000
  while (previousStartTimes.length>maxPreviousStartTimesLength) {
    previousStartTimes.shift()
  }
  let timeDifference = []
  for (let i = 1;i<previousStartTimes.length;i++) {
    timeDifference.push(Math.abs(previousStartTimes[i]-previousStartTimes[i-1]))
  } 
  let totalTime = timeDifference.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
  let avrgTime = totalTime/timeDifference.length
  return avrgTime
}
let updatingGameInfo = false
export async function updateGameInfo(autoSetNextRun = true) {
  console.log(`Updating gameIDs`)
  if (updatingGameInfo) return 10000
  updatingGameInfo = true
  let publicLobbies = await findPublicLobby();
  publicLobbies = publicLobbies.values().toArray()
  let startTime = Date.now()
  let active = {
    ids: await setHelpers.getSet(["info", "games", "active", "ids"]),
    ws: await mapHelpers.getMap(["info", "games", "active", "ws"]),
  };
  // Helper: load or create .ndjson file for a given date string (YYYY-MM-DD)
  async function loadOrCreateFile(dateStr) {
  const filename = `${dateStr}.ndjson`;
  const folder = "logs";

  // Check if file exists
  const { data: list, error: listErr } = await supabase.storage.from(folder).list("", {
    search: filename
  });

  if (listErr) throw new Error(`Failed to list files: ${listErr.message}`);
  const fileExists = list.some(f => f.name === filename);
  if (!fileExists) {
    const { error } = await supabase.storage.from("logs").upload(filename, new Blob([""]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) {
      console.error(error)
    }
  }

  // Download the file
  const { data, error } = await supabase.storage.from(folder).download(filename);
  if (error) throw new Error(`Failed to download ${filename}: ${JSON.stringify(error)}`)
    
  const text = await data.text();
  return text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
}


  // Helper: save the updated daily arrays back to Supabase
  async function saveFile(dateStr, arrays) {
    const filename = `${dateStr}.ndjson`; // ✅ FIXED (was: logs/${dateStr}.ndjson)
    const content = JSON.stringify(arrays)
    const { error } = await supabase.storage.from("logs").upload(filename, new Blob([content]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) {
      console.error(`Error uploading log file ${filename}:`, error);
    }
  }

  // Map date string => array of archived game IDs to append
  const dateToNewIds = new Map();

  for (const currentId of active.ids.values().toArray()) {
    const wsValue = active.ws.get(currentId);
    if (!wsValue) continue;

    const res = await fetch(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/archived_game/${currentId}`);
    console.log(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/archived_game/${currentId}`)
    const archived = await res.json();

    if (archived.exists) {
      // Parse end date from archived.gameRecord.info.end
      // Assuming ISO string or timestamp
      let gameRecord = archived?.gameRecord
      let endDateRaw = gameRecord?.info?.end;
      if (!endDateRaw) {
        gameRecord = await getGame(currentId)
        gameRecord = await gameRecord.json()
        endDateRaw = gameRecord?.info?.end;
        if (!endDateRaw) {
          console.warn(`Missing end date for archived game ${currentId}`);
          await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
          await setHelpers.delete(["info", "games", "active", "ids"], currentId);
          continue;
        }
      }
      const endDate = new Date(endDateRaw);
      if (isNaN(endDate.getTime())) {
        console.warn(`Invalid end date for archived game ${currentId}: ${endDateRaw}`);
        continue;
      }

      const dateStr = endDate.toISOString().slice(0, 10); // YYYY-MM-DD UTC date

      // Add currentId to dateToNewIds map
      if (!dateToNewIds.has(dateStr)) {
        dateToNewIds.set(dateStr, []);
      }
      dateToNewIds.get(dateStr).push(currentId);
      previousStartTimes.push(gameRecord.info.start)
      // Update your sets/maps as before
      //await setHelpers.add(["info", "games", "ids"], currentId);
      await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
      await setHelpers.delete(["info", "games", "active", "ids"], currentId);
    } else {
      let game = await fetch(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/game/${currentId}`);
      console.log(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/game/${currentId}`/)
      game = await game.json();
      if (game.error) {
        if (game.error === "Game not found") {
          await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
          await setHelpers.delete(["info", "games", "active", "ids"], currentId);
        }
      }
    }
  }

  // For each date, load existing file, append new IDs, and save
  for (const [dateStr, newIds] of dateToNewIds.entries()) {
    console.log(`Adding ${newIds} to ${dateStr}.ndjson`)
    let existingArrays = await loadOrCreateFile(dateStr)
    existingArrays.push(newIds);
    existingArrays = new Set(existingArrays)
    existingArrays = existingArrays.values().toArray().flat()
    await saveFile(dateStr, existingArrays);
  }
  let timeTaken = Date.now() - startTime
  let lobbiesTimesToStart = publicLobbies.map(lobby => [lobby.msUntilStart,((lobby.gameConfig.maxPlayers-lobby.numClients)/3)*1000]).flat()
  lobbiesTimesToStart = lobbiesTimesToStart.map(time => (time-timeTaken>0 ? time-timeTaken : 500))
  let waitTime = Math.min(...lobbiesTimesToStart)
  updatingGameInfo = false
  if (autoSetNextRun) {
    console.log(`Runing again in ${waitTime}ms`)
    await new Promise(() => setTimeout(updateGameInfo, waitTime))
  } else console.log(`Suggested wait ${waitTime}ms`)
  return waitTime
}
findPublicLobby().then(console.log);
await updateGameInfo(true)
Deno.serve(() => new Response("Hello, world!"));
