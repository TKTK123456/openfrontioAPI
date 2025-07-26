import { createServer } from "node:http";
import bodyParser from "body-parser";
import express from 'express'
import { WebSocketServer } from "ws";
import path from 'node:path'
import { setHelpers, mapHelpers, getGameIds, getAllGameIds, getRangeGameIds } from './info.js'
import { findGameWebSocket, findPublicLobby, getPlayer, getGame } from './fetchers.js'
import config from './config.js'
const __dirname = path.resolve();
const kv = await Deno.openKv();
const app = express()
app.use(express.static(__dirname));
app.use(bodyParser.json());
// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Parse raw text data
app.use(bodyParser.text());

// Parse binary data
app.use(bodyParser.raw());

app.get("/", async (req, res) => {
  try {
    res.sendFile("https://github.com/TKTK123456/openfrontioAPI/blob/acbece1dfb8ea72cabe6bf7755f215fade77b25e/index.html")
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    console.error(e)
    res.end("Error: " + e.message);
  }
});
app.get("/player", async (req, res) => {
  let id = req.query.id
  try {
    const response = await getPlayer(id)
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const data = await response.text();
    res.end(data);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    console.error(e)
    res.end("Error: " + e.message);
  }
})
app.get("/game", async (req, res) => {
  let id = req.query.id
  try {
    const response = await getGame(id)
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const data = await response.text();
    res.end(data);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    console.error(e)
    res.end("Error: " + e.message);
  }
})
app.get("/info/games/ids", async (req, res) => {
  let ids = await setHelpers.get(["info", "games", "ids"])
  ids = ids.values().toArray()
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(ids))
})
app.get("/data/gameIds/:start{-:end}", async (req, res) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "*");
  let gameIds = []
  const stringToDate = (string) => new Date(Date.UTC(string.slice(0,4), string.slice(4,6), string.slice(6)))
  if (Object.hasOwn(req.params, "start")) {
    if (req.params.start == "all") {
      gameIds = await getAllGameIds()
    } else if (Object.hasOwn(req.params, "end")) {
      let startDate = stringToDate(req.params.start)
      let endDate = stringToDate(req.params.end)
      gameIds = await getRangeGameIds(startDate, endDate)
    } else {
      let startDate = stringToDate(req.params.start)
      gameIds = await getGameIds(startDate)
    }
  }
  res.end(JSON.stringify(gameIds))
})
async function getMap(name) {
  let gameIds = await getAllGameIds()
  let maps = []
  for (let id of gameIds) {
    const response = await fetch(`https://api.openfront.io/game/${id}`);
    let resp = await response.json()
    let mapName = resp?.info?.config?.gameMap
    if (!mapName) {
      continue
    }
    if (mapName == name) {
      maps.push(id)
    }
  }
  return maps
}
app.get("/map/:name", async (req, res) => {
  const mapName = req.params.name;

  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Map Search Progress - ${mapName}</title>
    </head>
    <body>
      <h1>Searching for map: ${mapName}</h1>
      <div id="progress">Connecting...</div>
      <pre id="result"></pre>
      <script>
        const mapName = "${mapName}";
        const ws = new WebSocket("ws://" + location.host);
        alert(location.host)
        const progressEl = document.getElementById("progress");
        const resultEl = document.getElementById("result");

        ws.onopen = () => {
          progressEl.innerText = "Connected. Starting map scan...";
          ws.send(JSON.stringify({ type: "getMap", mapName }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.progress !== undefined) {
            progressEl.innerText = "Progress: " + data.progress + "% (" + data.currentCount + " checked, " + data.matches + " matches)";
          }

          if (data.done) {
            progressEl.innerText = "Finished!";
            resultEl.innerText = JSON.stringify(data.matches, null, 2);
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
    </html>
  `);
});
app.get("/stats/:map/:type", async (req, res) => {
  const mapName = req.params.map;
  const statType = req.params.type;

  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Stats for ${mapName} (${statType})</title>
    </head>
    <body>
      <h1>Stat Collection: ${statType} on ${mapName}</h1>
      <div id="progress">Connecting...</div>
      <pre id="result"></pre>
      <script>
        const mapName = "${mapName}";
        const statType = "${statType}";
        const ws = new WebSocket("ws://" + location.host);
        alert(location.host)
        const progressEl = document.getElementById("progress");
        const resultEl = document.getElementById("result");

        ws.onopen = () => {
          progressEl.innerText = "Connected. Starting stats fetch...";
          ws.send(JSON.stringify({ type: "getStats", mapName, statType }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.progress !== undefined) {
            progressEl.innerText = "Progress: " + data.progress + "%";
          }

          if (data.done) {
            progressEl.innerText = "Finished!";
            resultEl.innerText = JSON.stringify(data.stats, null, 2);
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
    </html>
  `);
});
//setInterval()
const server = createServer(app); // Attach WebSocket to the same server
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.on("message", async (msg) => {
    try {
      const { type, mapName, statType } = JSON.parse(msg.toString());

      if (type === "getMap") {
        const gameIds = await getAllGameIds();
        let matches = [];
        const total = gameIds.length;

        for (let i = 0; i < total; i++) {
          const id = gameIds[i];

          try {
            const response = await fetch(`https://api.openfront.io/game/${id}`);
            const game = await response.json();
            const currentMap = game?.info?.config?.gameMap;

            if (currentMap === mapName) {
              matches.push(id);
            }
          } catch (err) {
            // Ignore fetch errors
          }

          // Send progress every 25 steps or at the end
          if (i % 25 === 0 || i === total - 1) {
            ws.send(JSON.stringify({
              type: "progress",
              progress: Math.floor((i / total) * 100),
              currentCount: i,
              matches: matches.length
            }));
          }
        }

        ws.send(JSON.stringify({
          type: "done",
          done: true,
          matches
        }));
      }

      if (type === "getStats") {
        const gameIds = await getAllGameIds();
        let matches = [];

        for (const id of gameIds) {
          try {
            const response = await fetch(`https://api.openfront.io/game/${id}`);
            const game = await response.json();
            const map = game?.info?.config?.gameMap;
            if (map === mapName) {
              matches.push({ id, game });
            }
          } catch (e) {}
        }

        const latest = matches.at(-1);
        if (!latest) {
          return ws.send(JSON.stringify({ type: "error", error: "No matching games found" }));
        }

        const turns = latest.game.turns ?? [];
        let stats = {};

        if (statType === "spawns") {
          let spawns = new Map();
          for (const turn of turns) {
            for (const intent of turn.intents || []) {
              if (intent.type === "spawn") {
                spawns.set(intent.clientID, intent);
              }
            }
          }

          stats = {
            gameID: latest.id,
            playerSpawns: Array.from(spawns.values())
          };
        }

        ws.send(JSON.stringify({
          type: "done",
          done: true,
          stats
        }));
      }

    } catch (err) {
      console.error(err);
      ws.send(JSON.stringify({
        type: "error",
        error: err.message
      }));
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });
});
server.listen(8080);
/*const server = createServer(async (req, res) => {
  
  try {
    const response = await fetch(`https://api.openfront.io/player/wPHaVYX4`);
    //const response = await fetch(`https://api.openfront.io/game/d9oFrfjL`)
    // Forward status code & content-type
    res.statusCode = response.status;
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*"); // Enable CORS for clients

    const data = await response.text(); // Use text() to forward raw data
    res.end(data);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("Error: " + e.message);
  }
});

server.listen(8080)*/
