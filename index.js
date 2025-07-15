import { createServer } from "node:http";
import bodyParser from "body-parser";
import express from 'express'
import path from 'node:path'
const __dirname = path.resolve();
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
    res.sendFile(__dirname + "/index.html")
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("Error: " + e.message);
  }
});
app.get("/player", async (req, res) => {
  let id = req.query.id
  try {
    const response = await fetch(`https://api.openfront.io/player/${id}`);
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
})
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
