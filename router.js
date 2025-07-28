class Router {
  constructor() {
    this.routes = [];
    this.staticDir = null;
  }

  get(path, handler) {
    this.routes.push({ method: "GET", path, handler });
  }

  post(path, handler) {
    this.routes.push({ method: "POST", path, handler });
  }

  ws(path, handler) {
    this.routes.push({ method: "WS", path, handler });
  }

  useStatic(dir) {
    this.staticDir = dir;
  }

  async handle(req) {
    const url = new URL(req.url);
    const pathname = this.#normalizePath(url.pathname);
    const isWS = req.headers.get("upgrade")?.toLowerCase() === "websocket";
    const method = isWS ? "WS" : req.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = this.#matchRoute(pathname, route.path);
      if (!match) continue;

      if (isWS) {
        const { response, socket } = Deno.upgradeWebSocket(req);
        route.handler(socket, match.params);
        return response;
      }

      // Build query object with support for repeated keys
      const query = {};
      for (const [key, value] of url.searchParams.entries()) {
        if (query[key]) {
          query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value];
        } else {
          query[key] = value;
        }
      }

      const contentType = req.headers.get("content-type") || "";
      let body = null;

      if (contentType.includes("application/json")) {
        body = await req.json().catch(() => null);
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        body = Object.fromEntries(await req.formData());
      } else if (contentType.includes("text/plain")) {
        body = await req.text();
      }

      const ctx = {
        req,
        res: null,
        path: pathname,
        method,
        query,
        params: match.params,
        body,
        send: (data, opts = {}) => {
          const isText = typeof data === "string";
          ctx.res = new Response(isText ? data : JSON.stringify(data), {
            status: opts.status || 200,
            headers: {
              "content-type": opts.type || (isText ? "text/plain" : "application/json"),
              ...opts.headers,
            },
          });
        },
      };

      await route.handler(ctx);
      return ctx.res || new Response("No response", { status: 500 });
    }

    // static fallback
    if (this.staticDir) return await this.#tryStatic(pathname);
    return new Response("Not Found", { status: 404 });
  }

  #normalizePath(path) {
    return path.replace(/\/+$/, "") || "/";
  }

  #matchRoute(pathname, routePath) {
  const escapeRegex = str =>
    str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");

  const paramNames = [];

  let pattern = routePath
    .split("/")
    .filter(Boolean)
    .map(part => {
      // 1. Optional group: e.g. ":start{-:end}"
      if (part.includes("{") && part.includes("}")) {
        const [mainPart, groupPart] = part.split("{");
        const groupContent = groupPart.slice(0, -1); // remove '}'

        // Collect param names
        const collectParams = str => {
          const matches = [...str.matchAll(/:([a-zA-Z0-9_]+)/g)];
          return matches.map(m => m[1]);
        };

        paramNames.push(...collectParams(mainPart));
        paramNames.push(...collectParams(groupContent));

        const mainRegex = mainPart.replace(/:([a-zA-Z0-9_]+)/g, () => `([^-/]+)`);
        const groupRegex = groupContent.replace(/:([a-zA-Z0-9_]+)/g, () => `([^/]+)`);

        return `/${mainRegex}(?:${groupRegex})?`;
      }

      // 2. Normal named param: :id or :id? or :id(\d+)?
      const match = part.match(/^:([a-zA-Z0-9_]+)(\(([^)]+)\))?(\?)?$/);
      if (match) {
        const [, name, , regex, optional] = match;
        paramNames.push(name);
        const capture = regex || "[^/]+";
        return optional ? `(?:/(${capture}))?` : `/(${capture})`;
      }

      // 3. Wildcard param
      if (part === "*") {
        paramNames.push("wildcard");
        return "/(.*)";
      }

      // 4. Static path
      return "/" + escapeRegex(part);
    })
    .join("");

  const fullPattern = "^" + pattern + "/?$";
  const regex = new RegExp(fullPattern);
  const match = pathname.match(regex);
  if (!match) return null;

  const params = {};
  paramNames.forEach((name, i) => {
    params[name] = match[i + 1] ? decodeURIComponent(match[i + 1]) : undefined;
  });

  return { params };
}
  

  async #tryStatic(pathname) {
    try {
      const filepath = this.staticDir + decodeURIComponent(pathname);
      const file = await Deno.readFile(filepath);
      return new Response(file, {
        headers: { "content-type": this.#mime(filepath) },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }

  #mime(filePath) {
    const ext = filePath.split(".").pop();
    return {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      txt: "text/plain",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      svg: "image/svg+xml",
      ico: "image/x-icon",
    }[ext] || "application/octet-stream";
  }
}

export default function router() {
  return new Router();
}
