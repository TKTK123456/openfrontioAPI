import { createServer } from "node:http";
import process from "node:process";

const server = createServer(async (req, res) => {
  let message 
  let response = await fetch("https://api.openfront.io/player/wPHaVYX4");
  message = JSON.stringify(response.json())
  res.end(message);
});

server.listen(8080);
