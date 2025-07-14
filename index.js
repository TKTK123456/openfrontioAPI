import { createServer } from "node:http";
import process from "node:process";

const server = createServer((req, res) => {
  let message 
  fetch("https://api.openfront.io/player/wPHaVYX4")
  .then(res => res.json())
  .then((json) => message = JSON.stringify(json))
  .catch((e) => message = e);
  res.end(message);
});

server.listen(8080);
