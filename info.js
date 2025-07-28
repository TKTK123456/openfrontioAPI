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
export async function getGameIds(date) {
  let dateStr = date.toISOString().slice(0, 10)
  const filename = `${dateStr}.ndjson`;
  const folder = "logs";
  const { data: list, error: listErr } = await supabase.storage.from(folder).list("", {
    search: filename
  });
  const fileExists = list.some(f => f.name === filename);
  if (!fileExists) {
    console.error(`Could not find ${dateStr}`)
    return
  }
  const { data, error } = await supabase.storage.from(folder).download(filename);
  const text = await data.text();
  return text.trim() ? JSON.parse(text.trim()) : [];
}
function getDateRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate); // Create a new Date object from the start date

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate)); // Push a copy of the current date to the array
    currentDate.setDate(currentDate.getDate() + 1); // Increment the date by one day
  }

  return dates;
}

export async function getRangeGameIds(start, end) {
  let dates = getDateRange(start, end)
  console.log(dates)
  let allGameIds = []
  await Promise.all(dates.map(async (i) => {
    let gameIds = await getGameIds(new Date(i))
    allGameIds.push(...gameIds)
  }))
  return allGameIds
}
export async function getAllGameIds(mapType = true) {
  let startDate = new Date(1753637516478)
  let endDate = new Date()
  let allGames = await getRangeGameIds(startDate, endDate)
  if (!mapType) {
    allGames = allGames.map((i) => i.gameId)
  }
  return allGames
}
export async function getCordsFromTile(name, tile) {
  const manifest = await getMapManifest(name);
  if (!manifest || !manifest.map || typeof manifest.map.width !== 'number') {
    console.error('Invalid map manifest structure');
    return null;
  }

  const width = manifest.map.width;
  const x = tile % width;
  const y = Math.floor(tile / width);

  return { x, y };
}
export async function getMapManifest(name) {
  name = name.toLowerCase()
  const url = `https://raw.githubusercontent.com/openfrontio/OpenFrontIO/refs/heads/main/resources/maps/${name}/manifest.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const content = await response.json();
    return content;
  } catch (error) {
    console.error(`Error fetching file: ${error} with url ${url}`);
    return null;
  }
}
Deno.cron("Reminder to work", "*/3 * * * *", () => {
  fetch("https://tktk123456-openfrontio-50.deno.dev/")
});
