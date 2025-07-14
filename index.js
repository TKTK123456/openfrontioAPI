import { createServer } from "node:http";
import bodyParser from "body-parser";

const server = createServer(async (req, res) => {
  
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

server.listen(8080)
