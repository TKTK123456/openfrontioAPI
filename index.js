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
function getContentType(path: string): string {
  const ext = extname(path);
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

async function serveStaticFile(req: Request, filePath: string): Promise<Response> {
  try {
    const fullPath = join(__dirname, filePath);
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

function parseQuery(url: URL, key: string): string | null {
  return url.searchParams.get(key);
}

function parseUrlParam(pathname: string, prefix: string): string | null {
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length);
  }
  return null;
}

const stringToDate = (string: string) =>
  new Date(Date.UTC(
    parseInt(string.slice(0, 4)),
    parseInt(string.slice(4, 6)) - 1,
    parseInt(string.slice(6))
  ));

async function getMap(name: string) {
  const gameIds = await getAllGameIds();
  const maps = [];
  for (const id of gameIds) {
    const response = await fetch(`https://api.openfront.io/game/${id}`);
    if (!response.ok) continue;
    const resp = await response.json();
    const mapName = resp?.info?.config?.gameMap;
    if (!mapName) continue;
    if (mapName === name) {
      maps.push(id);
    }
  }
  return maps;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Serve static files from root dir for requests to "/"
  if (pathname === "/") {
    // Your original was sending an external URL - Deno cannot send remote file via sendFile, so redirect or fetch and serve
    // Let's redirect the user to the github file
    return new Response(null, {
      status: 302,
      headers: { "location": "https://github.com/TKTK123456/openfrontioAPI/blob/acbece1dfb8ea72cabe6bf7755f215fade77b25e/index.html" },
    });
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
    const mapName = pathname.slice("/map/".length);

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
    const mapName = "${mapName}";
    const ws = new WebSocket("wss://" + location.host + "/ws");
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
</html>`;
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }

  // /stats/:map/:type
  if (pathname.startsWith("/stats/")) {
    // Example path: /stats/Asia/typeA
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
    const mapName = "${mapName}";
    const statType = "${statType}";
    const ws = new WebSocket("wss://" + location.host + "/ws");
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
</html>`;
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
  }

  // Serve static files for other paths (like js/css/html) from current directory
  try {
    // Try to serve as static file
    const fileResponse = await serveStaticFile(req, pathname);
    if (fileResponse.status !== 404) {
      return fileResponse;
    }
  } catch {
    // fallthrough
  }

  return new Response("Not Found", { status: 404 });
}, { port: 8080 });
/*const app = express()
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
        alert(location.host)
        const ws = new WebSocket("wss://" + location.host+"/ws");
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
        alert(location.host)
        const ws = new WebSocket("wss://" + location.host+"/ws");
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
app.listen(8080);
Deno.serve({ port: 3000 }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname !== "/ws") {
    return new Response("Not found", { status: 404 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log("WebSocket opened");
    socket.send(JSON.stringify({ message: "WebSocket connection established" }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "getMap" && data.mapName) {
        const mapName = data.mapName;
        const gameIds = await getAllGameIds();
        const total = gameIds.length;
        const matches = [];

        for (let i = 0; i < total; i++) {
          const id = gameIds[i];
          try {
            const game = await fetchGameInfo(id);
            if (game && game.info && game.info.config && game.info.config.gameMap === mapName) {
              matches.push(id);
            }
          } catch {}

          // Send progress every game or at end
          if (i % 1 === 0 || i === total - 1) {
            socket.send(
              JSON.stringify({
                progress: Math.floor(((i + 1) / total) * 100),
                currentCount: i + 1,
                matchesCount: matches.length,
              }),
            );
          }
        }

        socket.send(JSON.stringify({ done: true, matches }));
      } else {
        socket.send(JSON.stringify({ error: "Invalid message" }));
      }
    } catch (e) {
      socket.send(JSON.stringify({ error: e.message }));
    }
  };

  socket.onerror = (e) => console.error("WebSocket error:", e);
  socket.onclose = () => console.log("WebSocket closed");

  return response;
});
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

server.listen(8080)*/
