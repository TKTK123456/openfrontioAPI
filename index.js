import { createServer } from "node:http";
import process from "node:process";

const server = createServer(async (req, res) => {
  let message 
  try {
  let response = await fetch("https://api.openfront.io/player/wPHaVYX4");
  message = await response.json()
  } catch (e) {
    res.end(e)
  }
  res.end(JSON.stringify(message));
});

server.listen(8080);
