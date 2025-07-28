import { createServer } from "node:http";
import fs from "node:fs/promises";
import bodyParser from "body-parser";
import express from 'express'
import { WebSocketServer } from "ws";
import path from 'node:path'
import { setHelpers, mapHelpers, getGameIds, getAllGameIds, getRangeGameIds, getCordsFromTile } from './info.js'
import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import config from './config.js'
import router from "./router.js";
const __dirname = path.resolve();
const kv = await Deno.openKv();
function getContentType(Path) {
  const ext = path.extname(Path);
  switch (ext) {
    case ".html": return "text/html";
    case ".js": return "application/javascript";
    case ".css": return "text/css";
    case ".json": return "application/json";
    case ".txt": return "text/plain";
    case ".wasm": return "application/wasm";
    default: return "application/octet-stream";
  }
}

async function serveStaticFile(req, filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const file = await Deno.readFile(fullPath);
    return new Response(file, {
      status: 200,
      headers: {
        "content-type": getContentType(fullPath),
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

function parseQuery(url, key) {
  return url.searchParams.get(key);
}
function stringToDate(string) {
  return new Date(Date.UTC(
    parseInt(string.slice(0, 4)),
    parseInt(string.slice(4, 6)) - 1,
    parseInt(string.slice(6))
  ));
}
const encoder = new TextEncoder();

async function readJsonFile(filename) {
  try {
    const fullPath = path.join(__dirname, filename);
    const text = await Deno.readTextFile(fullPath);
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return null;
    }
    throw err;
  }
}

async function writeJsonFile(filename, data) {
  const jsonString = JSON.stringify(data, null, 2);
  const encoded = encoder.encode(jsonString);
  const fullPath = path.join(__dirname, filename);

  // Ensure directory exists
  const dir = path.dirname(fullPath);
  await Deno.mkdir(dir, { recursive: true });

  await Deno.writeFile(fullPath, encoded);
}

async function getMap(name, socket = null) {
  const games = await getAllGameIds();
  const total = games.length;
  const matches = [];
  const filename = `${name}.json`;

  // Try to load previous progress
  const parsed = null//await readJsonFile(filename);

  let startIndex = 0;
  if (parsed) {
    if (typeof parsed.lastChecked === "number" && parsed.lastChecked >= total) {
      return Array.isArray(parsed.matches) ? parsed.matches : [];
    }
    startIndex = typeof parsed.lastChecked === "number" ? parsed.lastChecked : 0;
    if (Array.isArray(parsed.matches)) {
      matches.push(...parsed.matches);
    }
  }

  for (let i = startIndex; i < total; i++) {
    if (games[i].mapType === name) matches.push(games[i].gameId)

    // Save progress with index
    const dataToWrite = {
      lastChecked: i + 1,
      matches,
    };
    try {
      //await writeJsonFile(filename, dataToWrite);
    } catch (err) {
      console.error(`Error writing to file ${filename}:`, err);
    }

    if (socket) {
      socket.send(
        JSON.stringify({
          type: "progress",
          task: "filterGames",
          progress: Math.floor(((i + 1) / total) * 100),
          currentCount: i + 1,
          total,
          matchesCount: matches.length,
        })
      );
    }
  }

  return matches;
}

const r = router();

r.useStatic(__direname); // or your static directory

r.get("/", async ({ send }) => {
  const response = await serveStaticFile(null, "/index.html");
  send(await response.text(), { type: "text/html" });
});

r.get("/player", async ({ query, send }) => {
  const id = query.id;
  if (!id) return send("Missing id parameter", { status: 400 });
  try {
    const response = await getPlayer(id);
    const data = await response.text();
    send(data, { type: "application/json" });
  } catch (e) {
    send(`Error: ${e.message}`, { status: 500 });
  }
});

r.get("/game", async ({ query, send }) => {
  const id = query.id;
  if (!id) return send("Missing id parameter", { status: 400 });
  try {
    const response = await getGame(id);
    const data = await response.text();
    send(data, { type: "application/json" });
  } catch (e) {
    send(`Error: ${e.message}`, { status: 500 });
  }
});

r.get("/info/games/ids", async ({ send }) => {
  try {
    let ids = await setHelpers.get(["info", "games", "ids"]);
    ids = [...ids.values()];
    send(JSON.stringify(ids), { type: "application/json" });
  } catch (e) {
    send(`Error: ${e.message}`, { status: 500 });
  }
});

r.get("/data/gameIds/:param", async ({ params, send }) => {
  const param = params.param;
  let gameIds = [];
  try {
    if (param === "all") {
      gameIds = await getAllGameIds();
    } else if (param.includes("-")) {
      const [start, end] = param.split("-");
      const startDate = stringToDate(start);
      const endDate = stringToDate(end);
      gameIds = await getRangeGameIds(startDate, endDate);
    } else {
      const startDate = stringToDate(param);
      gameIds = await getGameIds(startDate);
    }
    send(JSON.stringify(gameIds), { type: "application/json" });
  } catch (e) {
    send(`Error: ${e.message}`, { status: 500 });
  }
});

// For /map/:name
r.get("/map/:name", ({ params, send }) => {
  const mapName = params.name;
  const html = `<!DOCTYPE html>
<html>
<head><title>Map Search Progress - ${mapName}</title></head>
<body>
  <h1>Searching for map: ${mapName}</h1>
  <div id="progress">Connecting...</div>
  <pre id="result"></pre>
  <script>
    const mapName = ${JSON.stringify(mapName)};
    const ws = new WebSocket("wss://" + location.host + "/ws");
    const progressEl = document.getElementById("progress");
    const resultEl = document.getElementById("result");
    ws.onopen = () => {
      progressEl.innerText = "Connected. Starting stats fetch...";
      ws.send(JSON.stringify({ type: "getMap", mapName }));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "progress") {
        if (data.task === "filterGames") {
          progressEl.innerText = \`Map Progress: \${data.progress}% (\${data.currentCount}/\${data.total} checked, \${data.matchesCount} matches)\`;
        } else if (data.task === "getStats") {
          progressEl.innerText = \`\${data.statType.charAt(0).toUpperCase() + data.statType.slice(1).toLowerCase()} Stat Progress: Game \${data.currentGame}/\${data.totalGames}, Intents processed: \${data.currentIntents}, Tracked entries: \${data.tracked}\`;
        } else {
          progressEl.innerText = \`Progress (\${data.task}): \${data.progress}% (\${data.currentCount} checked)\`;
        }
      }
      if (data.done) {
        progressEl.innerText = "Finished!";
        if (data.matches) {
          resultEl.innerText = JSON.stringify(data.matches, null, 2);
        } else if (data.stats) {
          resultEl.innerText = JSON.stringify(data.stats, null, 2);
        } else {
          resultEl.innerText = "Done, but no results returned.";
        }
      }
      if (data.error) {
        progressEl.innerText = "Error: " + data.error;
      }
    };
    ws.onerror = () => { progressEl.innerText = "WebSocket error."; };
    ws.onclose = () => { progressEl.innerText += "\\nConnection closed."; };
  </script>
</body>
</html>`;
  send(html, { type: "text/html" });
});

// For /stats/:map/:type
r.get("/stats/:map/:type", ({ params, send }) => {
  const mapName = params.map;
  const statType = params.type;
  const html = `<!DOCTYPE html>
<html>
<head><title>Stats for ${mapName} (${statType})</title></head>
<body>
  <h1>Stat Collection: ${statType} on ${mapName}</h1>
  <div id="progress">Connecting...</div>
  <pre id="result"></pre>
  <script>
    const mapName = ${JSON.stringify(mapName)};
    const statType = ${JSON.stringify(statType)};
    const ws = new WebSocket("wss://" + location.host + "/ws");
    const progressEl = document.getElementById("progress");
    const resultEl = document.getElementById("result");
    ws.onopen = () => {
      progressEl.innerText = "Connected. Starting stats fetch...";
      ws.send(JSON.stringify({ type: "getStats", mapName, statType }));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "progress") {
        if (data.task === "filterGames") {
          progressEl.innerText = \`Map Progress: \${data.progress}% (\${data.currentCount}/\${data.total} checked, \${data.matchesCount} matches)\`;
        } else if (data.task === "getStats") {
          progressEl.innerText = \`\${data.statType.charAt(0).toUpperCase() + data.statType.slice(1).toLowerCase()} Stat Progress: Game \${data.currentGame}/\${data.totalGames}, Intents processed: \${data.currentIntents}, Tracked entries: \${data.tracked}\`;
        } else {
          progressEl.innerText = \`Progress (\${data.task}): \${data.progress}% (\${data.currentCount} checked)\`;
        }
      }
      if (data.done) {
        progressEl.innerText = "Finished!";
        if (data.matches) {
          resultEl.innerText = JSON.stringify(data.matches, null, 2);
        } else if (data.stats) {
          resultEl.innerText = JSON.stringify(data.stats, null, 2);
        } else {
          resultEl.innerText = "Done, but no results returned.";
        }
      }
      if (data.error) {
        progressEl.innerText = "Error: " + data.error;
      }
    };
    ws.onerror = () => { progressEl.innerText = "WebSocket error."; };
    ws.onclose = () => { progressEl.innerText += "\\nConnection closed."; };
  </script>
</body>
</html>`;
  send(html, { type: "text/html" });
});

// WebSocket handler
r.ws("/ws", (socket) => {
  socket.onopen = () => {
    console.log("WebSocket opened");
    socket.send(JSON.stringify({ message: "WebSocket connection established" }));
  };

  socket.onmessage = async (event) => {
    console.log(event)
    try {
      const data = JSON.parse(event.data);

      if (!data.mapName) {
        socket.send(JSON.stringify({ error: "Missing mapName" }));
        return;
      }

      const matches = await getMap(data.mapName, socket);

      if (data.type === "getMap") {
        socket.send(JSON.stringify({ done: true, matches }));
        return;
      }

      if (data.type === "getStats") {
        const stats = {};
        let totalIntents = 0;
        stats[data.statType] = [];
        if (data.statType === "spawns") stats[data.statType] = new Map();

        for (let i = 0; i < matches.length; i++) {
          const id = matches[i];
          try {
            const game = await fetch(`https://api.openfront.io/game/${id}`).then(r => r.json());

            for (const turn of game.turns ?? []) {
              for (const intent of turn.intents ?? []) {
                totalIntents++;

                if (data.statType === "spawns" && intent.type === "spawn") {
                  intent.tile = await getCordsFromTile(data.mapName, intent.tile);
                  stats[data.statType].set(intent.clientID, { ...intent, gameId: id });
                }

                // You can add more statType logic here

                if (totalIntents % 100 === 0) {
                  socket.send(JSON.stringify({
                    type: "progress",
                    task: "getStats",
                    statType: data.statType,
                    currentGame: i + 1,
                    totalGames: matches.length,
                    currentIntents: totalIntents,
                    tracked: Object.keys(stats).length,
                  }));
                }
              }
            }
          } catch {}
        }

        if (data.statType === "spawns") stats[data.statType] = Array.from(stats[data.statType].values());

        socket.send(JSON.stringify({ done: true, stats }));
        return;
      }

    } catch (e) {
      socket.send(JSON.stringify({ error: e.message }));
    }
  };

  socket.onerror = (e) => console.error("WebSocket error:", e);
  socket.onclose = () => console.log("WebSocket closed");
});

// Final fallback to static file
// This will be handled by router's useStatic

Deno.serve((req) => r.handle(req), { port: 8080 });
