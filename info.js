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
function getDatesInRange(start, end) {
  let dateRange = []
  while (start<end) {
    dateRange.push(new Date(start))
    start = start.setDate(start.getDate() + 1)
  }
  return dateRange
}
export async function getAllGameIds() {
  let startDate = new Date(1753020235726)
  let endDate = new Date()
  let allDates = getDatesInRange(startDate, endDate)
  console.log(allDates)
}
getAllGameIds()
Deno.cron("Reminder to work", "*/5 * * * *", () => {
  fetch("https://tktk123456-openfrontio-50.deno.dev/")
});
