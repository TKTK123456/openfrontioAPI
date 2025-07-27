import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import Bunzip from 'seek-bzip';
import tar from 'tar-stream';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import config from './config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://ebnqhovfhgfrfxzexdxj.supabase.co", process.env.SUPABASE_TOKEN);
const kv = await Deno.openKv();

export const setHelpers = {
  folder: "storage",
  filename: "sets.ndjson",
  keyParser: function(key) {
    return key.join("/")
  },
  add: async function(key, value) {
    let fullSet = await this.getSet(key);
    if (fullSet.has(value)) return;
    fullSet.add(value);
    await this.saveSet(key, fullSet);
  },
  getSet: async function(key) {
    key = this.keyParser(key);
    let output = await this.getFile();
    output = output[key];
    if (output) {
      output = new Set(output);
    } else {
      output = new Set();
    }
    return output;
  },
  delete: async function(key, setKey) {
    let fullSet = await this.getSet(key);
    if (!fullSet.has(setKey)) return;
    fullSet.delete(setKey);
    await this.saveSet(key, fullSet);
  },
  saveSet: async function(key, set) {
    key = this.keyParser(key);
    set = Array.from(set.values());
    let file = await this.getFile();
    file[key] = set;
    await this.saveFile(file);
  },
  saveFile: async function(fileJSON) {
    fileJSON = JSON.stringify(fileJSON);
    const { error } = await supabase.storage.from(this.folder).upload(this.filename, new Blob([fileJSON]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) console.error(error);
  },
  getFile: async function() {
    let { data, error } = await supabase.storage.from(this.folder).download(this.filename);
    if (error) throw new Error(`Failed to download ${this.filename}: ${JSON.stringify(error)}`);
    data = await data.text();
    return JSON.parse(data);
  }
};

export const mapHelpers = {
  folder: "storage",
  filename: "maps.ndjson",
  keyParser: function(key) {
    return key.join("/");
  },
  set: async function(key, mapKey, value) {
    let fullMap = await this.getMap(key);
    if (fullMap.has(mapKey)) return;
    fullMap.set(mapKey, value);
    await this.saveMap(key, fullMap);
  },
  getMap: async function(key) {
    key = this.keyParser(key);
    let output = await this.getFile();
    output = output[key];
    if (output) {
      output = new Map(output);
    } else {
      output = new Map();
    }
    return output;
  },
  get: async function(key, mapKey) {
    let fullMap = await this.getMap(key);
    return fullMap.get(mapKey);
  },
  delete: async function(key, mapKey) {
    let fullMap = await this.getMap(key);
    if (!fullMap.has(mapKey)) return;
    fullMap.delete(mapKey);
    await this.saveMap(key, fullMap);
  },
  saveMap: async function(key, map) {
    key = this.keyParser(key);
    map = Array.from(map.entries());
    let file = await this.getFile();
    file[key] = map;
    await this.saveFile(file);
  },
  saveFile: async function(fileJSON) {
    fileJSON = JSON.stringify(fileJSON);
    const { error } = await supabase.storage.from(this.folder).upload(this.filename, new Blob([fileJSON]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) console.error(error);
  },
  getFile: async function() {
    let { data, error } = await supabase.storage.from(this.folder).download(this.filename);
    if (error) console.error(`Failed to download ${this.filename}: ${JSON.stringify(error)}`);
    data = await data.text();
    return JSON.parse(data);
  }
};

export const storageTxtHelper = {
  folder: "storage",
  ext: ".txt",
  get: async function(file) {
    file = file + this.ext;
    const { data, error } = await supabase.storage.from(this.folder).download(file);
    if (error) console.error(`Failed to download ${file}: ${JSON.stringify(error)}`);
    return data.text();
  },
  set: async function(file, content) {
    file = file + this.ext;
    const { error } = await supabase.storage.from(this.folder).upload(file, new Blob([content]), {
      upsert: true
    });
    if (error) console.error(error);
  }
};

let defaultClientsToTime = await storageTxtHelper.get("clientsToTime");
defaultClientsToTime = parseInt(defaultClientsToTime);
let clientsToTime = [defaultClientsToTime];

async function getAvrgTimeRaito(currentClientsToTime = false) {
  if (currentClientsToTime) clientsToTime.push(...currentClientsToTime);
  if (clientsToTime.length < 2) return (currentClientsToTime ? Math.min(...currentClientsToTime) : defaultClientsToTime);
  let totalTime = clientsToTime.reduce((acc, cur) => acc + cur, 0);
  let avrgTime = totalTime / clientsToTime.length;
  defaultClientsToTime = avrgTime;
  storageTxtHelper.set("clientsToTime", defaultClientsToTime);
  return avrgTime;
}

async function loadOrCreateFile(dateStr, mapType) {
  const folder = `logs/${dateStr}`;
  const filename = `${mapType}.ndjson`;

  const { data: list, error: listErr } = await supabase.storage.from(folder).list("", {
    search: filename,
  });

  if (listErr) throw new Error(`Failed to list files: ${listErr.message}`);
  const fileExists = list.some(f => f.name === filename);

  if (!fileExists) {
    const { error } = await supabase.storage.from(folder).upload(filename, new Blob([""]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) console.error(error);
  }

  const { data, error } = await supabase.storage.from(folder).download(filename);
  if (error) throw new Error(`Failed to download ${folder}/${filename}: ${JSON.stringify(error)}`);

  const text = await data.text();
  return text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
}

async function saveFile(dateStr, mapType, entries) {
  const folder = `logs/${dateStr}`;
  const filename = `${mapType}.ndjson`;
  const content = entries.map(JSON.stringify).join("\n");

  const { error } = await supabase.storage.from(folder).upload(filename, new Blob([content]), {
    upsert: true,
    contentType: "application/x-ndjson",
  });

  if (error) console.error(`Error uploading log file ${folder}/${filename}:`, error);
}

let updatingGameInfo = false;

export async function updateGameInfo(autoSetNextRun = true, { type = "auto", log = true, autoSetNextRunType = type } = {}) {
  const logger = msg => { if (log) console.log(msg); };
  const waitTime = 10000;
  if (updatingGameInfo) {
    if (autoSetNextRun) {
      logger(`Trying again in ${waitTime}ms`);
      await new Promise(resolve => setTimeout(() => updateGameInfo(true, { type: autoSetNextRunType }), waitTime));
    }
    return 10000
  };
  updatingGameInfo = true;
    if (type === "selfFetch" || type === "auto") {
    try {
      const publicLobbies = await findPublicLobby();
      const lobbies = Array.from(publicLobbies.values());

      for (const lobby of lobbies) {
        setHelpers.add(["info", "games", "active", "ids"], lobby.gameId);
        mapHelpers.set(["info", "games", "active", "ws"], lobby.gameId, lobby.wsId);
      }
    } catch (e) {
      if (type === "auto") {
        updatingGameInfo = false;
        await updateGameInfo(autoSetNextRun, {type: "openfront.pro", autoSetNextRunType}
      }
    }
    } else if (type === "openfront.pro") {
      const addGames = await fetch("https://openfront.pro/api/v1/lobbies");
      const games = await addGames.json();
      for (const game of games) {
        setHelpers.add(["info", "games", "active", "ids"], game.game_id);
        mapHelpers.set(["info", "games", "active", "ws"], game.game_id, "unknown");
      }
    }
    logger("Updating gameIDs");
    const active = {
      ids: await setHelpers.getSet(["info", "games", "active", "ids"]),
      ws: await mapHelpers.getMap(["info", "games", "active", "ws"]),
    };

    const dateToMapTypeEntries = new Map();
    for (const currentId of Array.from(active.ids)) {
      const wsValue = active.ws.get(currentId);
      if (!wsValue) continue;

      const res = await getGame(currentId);
      const gameRecord = await res.json();

      if (!gameRecord?.error) {
        const endDateRaw = gameRecord?.info?.end;
        if (!endDateRaw) continue;
        const endDate = new Date(endDateRaw);
        if (isNaN(endDate.getTime())) continue;

        const dateStr = endDate.toISOString().slice(0, 10);
        const mapType = gameRecord?.info?.config?.gameMap || "unknown";
        const key = `${dateStr}::${mapType}`;
        if (!dateToMapTypeEntries.has(key)) dateToMapTypeEntries.set(key, []);
        dateToMapTypeEntries.get(key).push({ gameId: currentId });

        await mapHelpers.delete(["info", "games", "active", "ws"], currentId);
        await setHelpers.delete(["info", "games", "active", "ids"], currentId);
      }
    }

    for (const [key, newEntries] of dateToMapTypeEntries.entries()) {
      const [dateStr, mapType] = key.split("::");
      logger(`Adding ${newEntries.length} games to ${dateStr}/${mapType}.ndjson`);

      let existingEntries = await loadOrCreateFile(dateStr, mapType);
      const existingIds = new Set(existingEntries.map(e => e.gameId));
      for (const entry of newEntries) {
        if (!existingIds.has(entry.gameId)) existingEntries.push(entry);
      }
      await saveFile(dateStr, mapType, existingEntries);
    }

    updatingGameInfo = false;
    if (autoSetNextRun) {
      const waitTime = 10000;
      logger(`Running again in ${waitTime}ms`);
      await new Promise(resolve => setTimeout(() => updateGameInfo(true, { type: autoSetNextRunType }), waitTime));
    }
  return 10000
}

await updateGameInfo(true);
Deno.serve(() => new Response("Hello, world!"));
