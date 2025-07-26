import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import Bunzip from 'seek-bzip';
import tar from 'tar-stream';
import { Buffer } from 'node:buffer'; 
import { Readable } from 'node:stream';
import config from './config.js'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient("https://ebnqhovfhgfrfxzexdxj.supabase.co", process.env.SUPABASE_TOKEN)
const kv = await Deno.openKv();
//await kv.set(["default", "clientsToTime"], 571.428571429)
export const setHelpers = {
  folder: "storage",
  filename: "sets.ndjson",
  keyParser: function(key) {
    return key.join("/")
  },
  add: async function(key, value) {
    let fullSet = await this.getSet(key)
    if (fullSet.has(value)) return
    fullSet.add(value);
    console.log(key, fullSet)
    await this.saveSet(key, fullSet);
  },
  getSet: async function(key) {
    key = this.keyParser(key)
    let output = await this.getFile()[key]
    console.log('Output:', output)
    if (output) {
      output = new Set(output)
    } else {
      output = new Set();
    }
    return output;
  },
  delete: async function(key, setKey) {
    let fullSet = await this.getSet(key)
    if (!fullSet.has(setKey)) return
    fullSet.delete(setKey);
    await this.saveSet(key, fullSet);
  },
  saveSet: async function(key, set) {
    key = this.keyParser(key)
    set = set.values().toArray()
    let file = await this.getFile()
    file[key] = set
    await this.saveFile(file)
  },
  saveFile: async function(fileJSON) {
    fileJSON = JSON.stringify(fileJSON)
    const { error } = await supabase.storage.from(this.folder).upload(this.filename, new Blob([fileJSON]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) {
      console.error(error)
    }
  },
  getFile: async function() {
    let { data, error } = await supabase.storage.from(this.folder).download(this.filename);
    if (error) throw new Error(`Failed to download ${this.filename}: ${JSON.stringify(error)}`)
    data = await data.text()
    return JSON.parse(data)
  }
}
export const mapHelpers = {
  folder: "storage",
  filename: "maps.ndjson",
  keyParser: function(key) {
    return key.join("/")
  },
  set: async function(key, mapKey, value) {
    let fullMap = await this.getMap(key)
    if (fullMap.has(mapKey)) return
    fullMap.set(mapKey, value)
    await this.saveMap(key, fullMap)
  },
  getMap: async function(key) {
    key = this.keyParser(key)
    let output = await this.getFile()[key]
    if (output) {
      output = new Map(output)
    } else {
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
    await this.saveMap(key, fullMap);
  },
  saveMap: async function(key, map) {
    key = this.keyParser(key)
    map = map.entries().toArray()
    let file = await this.getFile()
    file[key] = map
    await this.saveFile(file)
  },
  saveFile: async function(fileJSON) {
    fileJSON = JSON.stringify(fileJSON)
    const { error } = await supabase.storage.from(this.folder).upload(this.filename, new Blob([fileJSON]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) {
      console.error(error)
    }
  },
  getFile: async function() {
    let { data, error } = await supabase.storage.from(this.folder).download(this.filename);
    if (error) console.error(`Failed to download ${this.filename}: ${JSON.stringify(error)}`)
    data = await data.text()
    return JSON.parse(data)
  }
}
export const storageTxtHelper = {
  folder: "storage",
  ext: ".txt",
  get: async function(file) {
    file = file + this.ext
    const { data, error } = await supabase.storage.from(this.folder).download(file);
    if (error) console.error(`Failed to download ${file}: ${JSON.stringify(error)}`)
    return data.text()
  },
  set: async function(file, content) {
    file = file + this.ext
    const { error } = await supabase.storage.from(this.folder).upload(file, new Blob([content]), {
      upsert: true
    });
    if (error) console.error(error)
  }
}
let defaultClientsToTime = await storageTxtHelper.get("clientsToTime")
defaultClientsToTime = parseInt(defaultClientsToTime)
let clientsToTime = [defaultClientsToTime]
async function getAvrgTimeRaito(currentClientsToTime = false) {
  if (currentClientsToTime) clientsToTime.push(...currentClientsToTime)
  if (clientsToTime.length<2) return (currentClientsToTime ? Math.min(...currentClientsToTime) : defaultClientsToTime)
  let totalTime = clientsToTime.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
  let avrgTime = totalTime/clientsToTime.length
  defaultClientsToTime = avrgTime
  storageTxtHelper.set("clientsToTime", defaultClientsToTime)
  return avrgTime
}
let updatingGameInfo = false
export async function updateGameInfo(autoSetNextRun = true, { type = "auto", log = true, autoSetNextRunType = type } = {}) {
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
  let logger = function(msg) {
    if (log) console.log(msg)
  }
  if (type==="selfFetch"||type==="auto") {
  let startTime = Date.now()
  let publicLobbies;
  try {
    publicLobbies = await findPublicLobby();
    publicLobbies = publicLobbies.values().toArray()
  if (updatingGameInfo) {
      let timeTaken = Date.now() - startTime
      let timePerClient = await getAvrgTimeRaito(
        publicLobbies.map(lobby => {
          const timeRemaining = 60000 - lobby.msUntilStart;
          if (lobby.numClients === 0 || timeRemaining <= 0) return defaultClientsToTime; // prevent division by 0
          return timeRemaining / lobby.numClients;
        })
      );
  //console.log(`Average time per client join: ${timePerClient}ms`)
  let lobbiesTimesToStart = publicLobbies.map(lobby => [lobby.msUntilStart,(lobby.gameConfig.maxPlayers-lobby.numClients)*timePerClient]).flat()
  lobbiesTimesToStart = lobbiesTimesToStart.map(time => (time-timeTaken>0 ? time-timeTaken : 500))
  let waitTime = Math.min(...lobbiesTimesToStart)
  if (autoSetNextRun) {
    logger(`Already active trying again in ${waitTime}ms`)
    await new Promise(() => setTimeout(updateGameInfo, waitTime))
  } else logger(`Suggesting to try again in ${waitTime}ms`)
    return waitTime
  }
  updatingGameInfo = true
  logger(`Updating gameIDs`)
  let active = {
    ids: await setHelpers.getSet(["info", "games", "active", "ids"]),
    ws: await mapHelpers.getMap(["info", "games", "active", "ws"]),
  };
  // Helper: load or create .ndjson file for a given date string (YYYY-MM-DD)

  // Map date string => array of archived game IDs to append
  const dateToNewIds = new Map();

  for (const currentId of active.ids.values().toArray()) {
    const wsValue = active.ws.get(currentId);
    if (!wsValue) continue;
    const res = await getGame(currentId)
    const gameRecord = await res.json();

    if (!gameRecord?.error) {
      // Assuming ISO string or timestamp
      let endDateRaw = gameRecord?.info?.end;
      if (!endDateRaw) {
        console.warn(`Missing end date for archived game ${currentId}`);
        await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
        await setHelpers.delete(["info", "games", "active", "ids"], currentId);
        continue;
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
      // Update your sets/maps as before
      //await setHelpers.add(["info", "games", "ids"], currentId);
      await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
      await setHelpers.delete(["info", "games", "active", "ids"], currentId);
    } else {
      let game = await fetch(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/game/${currentId}`);
      //console.log(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/game/${currentId}`/)
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
let timePerClient = await getAvrgTimeRaito(
  publicLobbies.map(lobby => {
    const timeRemaining = 60000 - lobby.msUntilStart;
    if (lobby.numClients === 0 || timeRemaining <= 0) return defaultClientsToTime; // prevent division by 0
    return timeRemaining / lobby.numClients;
  })
);
  logger(`Average time per client join: ${timePerClient}ms`)
  let lobbiesTimesToStart = publicLobbies.map(lobby => [lobby.msUntilStart,(lobby.gameConfig.maxPlayers-lobby.numClients)*timePerClient]).flat()
  lobbiesTimesToStart = lobbiesTimesToStart.map(time => (time-timeTaken>0 ? time-timeTaken : 500))
  let waitTime = Math.min(...lobbiesTimesToStart)
  updatingGameInfo = false
  if (autoSetNextRun) {
    logger(`Runing again in ${waitTime}ms`)
    await new Promise(() => setTimeout(updateGameInfo, waitTime, false, {type:autoSetNextRunType}))
  } else logger(`Suggested wait ${waitTime}ms`)
  return waitTime
  } catch (error) {
    if (type==="auto") {
      await updateGameInfo(true, {type:"openfront.pro", autoSetNextRunType:autoSetNextRunType})
    } else console.error(error)
  }
  } else if (type==="openfront.pro") {
    try {
      let addGames = await fetch("https://openfront.pro/api/v1/lobbies")
      addGames = await addGames.json()
      for (let game of addGames) {
        let gameID = game.game_id
        setHelpers.add(["info", "games", "active", "ids"], gameID)
        mapHelpers.set(["info", "games", "active", "ws"], gameID, "unknown")
      }
      updatingGameInfo = true
  logger(`Updating gameIDs`)
  let active = {
    ids: await setHelpers.getSet(["info", "games", "active", "ids"]),
    ws: await mapHelpers.getMap(["info", "games", "active", "ws"]),
  };
  // Helper: load or create .ndjson file for a given date string (YYYY-MM-DD)

  // Map date string => array of archived game IDs to append
  const dateToNewIds = new Map();

  for (const currentId of active.ids.values().toArray()) {
    const wsValue = active.ws.get(currentId);
    if (!wsValue) continue;
    const res = await getGame(currentId)
    const gameRecord = await res.json();

    if (!gameRecord?.error) {
      // Assuming ISO string or timestamp
      let endDateRaw = gameRecord?.info?.end;
      if (!endDateRaw) {
        console.warn(`Missing end date for archived game ${currentId}`);
        await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
        await setHelpers.delete(["info", "games", "active", "ids"], currentId);
        continue;
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
      // Update your sets/maps as before
      //await setHelpers.add(["info", "games", "ids"], currentId);
      await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
      await setHelpers.delete(["info", "games", "active", "ids"], currentId);
    }
  }
      for (const [dateStr, newIds] of dateToNewIds.entries()) {
        console.log(`Adding ${newIds} to ${dateStr}.ndjson`)
        let existingArrays = await loadOrCreateFile(dateStr)
        existingArrays.push(newIds);
        existingArrays = new Set(existingArrays)
        existingArrays = existingArrays.values().toArray().flat()
        await saveFile(dateStr, existingArrays);
      }
      let waitTime = 10000;
      updatingGameInfo = false;
      if (autoSetNextRun) {
        logger(`Runing again in ${waitTime}ms`)
        await new Promise(() => setTimeout(updateGameInfo, waitTime, false, {type:autoSetNextRunType}))
  } else logger(`Suggested wait ${waitTime}ms`)
  return waitTime
  } catch (e) {
      console.error(e)
    }
  }
}
await updateGameInfo(true)
Deno.serve(() => new Response("Hello, world!"));
