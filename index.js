import { createServer } from "node:http";
import fs from "node:fs/promises";
import bodyParser from "body-parser";
import express from 'express'
import { WebSocketServer } from "ws";
import path from 'node:path'
import { setHelpers, mapHelpers, getGameIds, getAllGameIds, getRangeGameIds, getCordsFromTile } from './info.js'
import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import config from './config.js'
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
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === "/") {
  return await serveStaticFile(req, "/index.html");
}
  // /player?id=...
  if (pathname === "/player") {
    const id = parseQuery(url, "id");
    if (!id) return new Response("Missing id parameter", { status: 400 });
    try {
      const response = await getPlayer(id);
      const data = await response.text();
      return new Response(data, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  }
  // /game?id=...
  if (pathname === "/game") {
    const id = parseQuery(url, "id");
    if (!id) return new Response("Missing id parameter", { status: 400 });
    try {
      const response = await getGame(id);
      const data = await response.text();
      return new Response(data, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  }
  // /info/games/ids
  if (pathname === "/info/games/ids") {
    try {
      let ids = await setHelpers.get(["info", "games", "ids"]);
      ids = [...ids.values()];
      return new Response(JSON.stringify(ids), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  }
  // /data/gameIds/:start{-:end}
  if (pathname.startsWith("/data/gameIds/")) {
    const param = pathname.slice("/data/gameIds/".length);
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
      return new Response(JSON.stringify(gameIds), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  }
  // /map/:name
  if (pathname.startsWith("/map/")) {
    const parts = pathname.split("/")
    const mapName = parts[2];
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Map Search Progress - ${mapName}</title>
</head>
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

    ws.onerror = () => {
      progressEl.innerText = "WebSocket error.";
    };

    ws.onclose = () => {
      progressEl.innerText += "\\nConnection closed.";
    };
  </script>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }
  // /stats/:map/:type
  if (pathname.startsWith("/stats/")) {
    const parts = pathname.split("/");
    if (parts.length === 4) {
      const mapName = parts[2];
      const statType = parts[3];
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Stats for ${mapName} (${statType})</title>
</head>
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

    ws.onerror = () => {
      progressEl.innerText = "WebSocket error.";
    };

    ws.onclose = () => {
      progressEl.innerText += "\\nConnection closed.";
    };
  </script>
</body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
  }
  if (pathname === "/ws") {

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log("WebSocket opened");
    socket.send(JSON.stringify({ message: "WebSocket connection established" }));
  };

  socket.onmessage = async (event) => {
    console.log("Received WebSocket message:", event.data);
  try {
    const data = JSON.parse(event.data);

    if (!data.mapName) {
      socket.send(JSON.stringify({ error: "Missing mapName" }));
      return;
    }
    const matches = await getMap(data.mapName, socket)
    if (data.type === "getMap") {
      socket.send(JSON.stringify({ done: true, matches }));
      return;
    }

    // STEP 2: Handle stats
    if (data.type === "getStats") {
      const stats = {};
      let totalIntents = 0;
      stats[data.statType] = []
      if (data.statType === "spawns") stats[data.statType] = new Map()
      for (let i = 0; i < matches.length; i++) {
        const id = matches[i];
        try {
          const game = await fetch(`https://api.openfront.io/game/${id}`).then(r => r.json())
          
          for (const turn of game.turns ?? []) {
            for (const intent of turn.intents ?? []) {
              totalIntents++;

              if (data.statType === "spawns" && intent.type === "spawn") {
                intent.tile = await getCordsFromTile(data.mapName, intent.tile)
                stats[data.statType].set(intent.clientID, { ...intent, gameId: id });
              }

              // You can expand here for other statTypes
              // if (data.statType === "moves" && intent.type === "move") { ... }

              if (totalIntents % 100 === 0) {
                let statType = data.statType
                socket.send(JSON.stringify({
                  type: "progress",
                  task: "getStats",
                  statType,
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
      if (data.statType === "spawns") stats[data.statType] = stats[data.statType].values().toArray()
      socket.send(JSON.stringify({ done: true, stats }));
      return
    }

  } catch (e) {
    socket.send(JSON.stringify({ error: e.message }));
  }
};

  socket.onerror = (e) => console.error("WebSocket error:", e);
  socket.onclose = () => console.log("WebSocket closed");

  return response;
  }
  // Try static file fallback
  try {
    const fileResponse = await serveStaticFile(req, pathname);
    if (fileResponse.status !== 404) return fileResponse;
  } catch {}

  return new Response("Not Found", { status: 404 });
}, { port: 8080 });
