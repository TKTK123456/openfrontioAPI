import { createServer } from "node:http";
import bodyParser from "body-parser";
import express from 'express'
import path from 'node:path'
import { setHelpers, mapHelpers, getGameIds, getAllGameIds } from './info.js'
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
  let gameIds
  if (req.params.start == "all") {
    gameIds = await getAllGameIds()
  }
  res.end(JSON.stringify(gameIds))
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
