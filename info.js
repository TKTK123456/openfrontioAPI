import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import Bunzip from 'seek-bzip';
import tar from 'tar-stream';
import { Buffer } from 'node:buffer'; 
import { Readable } from 'node:stream';
import getDumpData from './getDumpData.js'
import config from './config.js'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient("https://ebnqhovfhgfrfxzexdxj.supabase.co", process.env.SUPABASE_TOKEN)
const kv = await Deno.openKv();
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
let lastFewStartTime = []
async function getHuristicTime() {
  if (lastFewStartTime.length<2) return 10000
  let timeDifference = []
  for (let i = 1;i<lastFewStartTime.length;i++) {
    timeDifference.push(lastFewStartTime[i]-lastFewStartTime[i-1])
  }
  let totalTime = timeDifference.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
  let avrgTime = totalTime/timeDifference.length
  return avrgTime
}
async function updateGameInfo(autoSetNextRun = true) {
  let publicLobbies = await findPublicLobby();
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
  if (error) throw new Error(`Failed to download ${filename}: ${JSON.stringify(error)}`);

  const text = await data.text();
  return text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
}


  // Helper: save the updated daily arrays back to Supabase
  async function saveFile(dateStr, arrays) {
    const filename = `logs/${dateStr}.ndjson`;
    const content = arrays.map(arr => JSON.stringify(arr)).join("\n") + "\n";
    console.log(content)
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

  for (const currentId of active.ids) {
    const wsValue = active.ws.get(currentId);
    if (!wsValue) continue;

    const res = await fetch(`https://${config.prefixs.use}${config.domain}/w${wsValue}/api/archived_game/${currentId}`);
    const archived = await res.json();

    if (archived.exists) {
      // Parse end date from archived.gameRecord.info.end
      // Assuming ISO string or timestamp
      let gameRecord = await getGame(currentId)
      gameRecord = await gameRecord.json()
      const endDateRaw = gameRecord.info?.end;
      if (!endDateRaw) {
        console.warn(`Missing end date for archived game ${currentId}`);
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

  // For each date, load existing file, append new IDs, and save
  for (const [dateStr, newIds] of dateToNewIds.entries()) {
    const existingArrays = await loadOrCreateFile(dateStr)
    console.log(existingArrays)
    existingArrays.push(newIds);
    await saveFile(dateStr, existingArrays);
  }
}
findPublicLobby().then(console.log);
updateGameInfo()
