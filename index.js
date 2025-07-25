import { createServer } from "node:http";
import bodyParser from "body-parser";
import express from 'express'
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
  gameIds.reverse()
  for (let id of gameIds) {
    const response = await fetch(`https://api.openfront.io/game/${id}`);
    let resp = await response.json()
    let mapName = resp?.info?.config?.gameMap
    if (!mapName) {
      continue
    }
    if (mapName == name) {
      return resp
    }
  }
}
app.get("/map/:name", async (req, res) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "*");
  let game = await getMap(req.params.name)
  res.end(JSON.stringify(game))
})
app.get("/stats/:map/:type", async (req, res) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "*");
  let mapName = req.params.map
  let type = req.params.type
  let game = await getMap(mapName)
  let allTurns = game.info.turns
  console.log(allTurns)
  if (type === "spawns") {
    let playerSpawns = new Map()
    allTurns.forEach((turn) => {
      turn.intents.forEach((intent) => {
        if (intent.type==="spawn") {
          playerSpawns.set(intent.clientID, intent)
        }
      })
    })
    playerSpawns = playerSpawns.values().toArray()
    res.end(JSON.stringify(playerSpawns))
  }
})
//setInterval()
app.listen(8080)
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
