import { createServer } from "node:http";
import process from "node:process";

const server = createServer((req, res) => {
  const message = `Hello from ${process.env.DENO_REGION} at ${new Date()}`;
  res.end(message);
});

server.listen(8080);
