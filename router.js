// router.js
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

  useStatic(dir) {
    this.staticDir = dir;
  }

  async handle(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = this.#matchRoute(pathname, route.path);
      if (match) {
        const query = Object.fromEntries(url.searchParams.entries());
        const contentType = req.headers.get("content-type") || "";
        let body = null;

        if (contentType.includes("application/json")) {
          body = await req.json();
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
    }

    // fallback to static
    if (this.staticDir) {
      return await this.#tryStatic(pathname);
    }

    return new Response("Not Found", { status: 404 });
  }

  #matchRoute(pathname, routePath) {
    const pathParts = pathname.split("/").filter(Boolean);
    const routeParts = routePath.split("/").filter(Boolean);
    if (pathParts.length < routeParts.length) return null;

    const params = {};

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      // advanced :start{-:end} support
      if (routePart.includes("{")) {
        const [main, group] = routePart.split("{");
        const groupContent = group.slice(0, -1);

        const paramRegex = (main + groupContent).replace(/:([\w]+)/g, (_, name) => `(?<${name}>[^/]+)`);
        const fullRegex = new RegExp(`^${paramRegex}$`);
        const match = pathPart.match(fullRegex);
        if (!match?.groups) return null;

        Object.assign(params, match.groups);
      }
      else if (routePart.startsWith(":")) {
        params[routePart.slice(1)] = decodeURIComponent(pathPart);
      }
      else if (routePart !== pathPart) {
        return null;
      }
    }

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
    return ({
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
    })[ext] || "application/octet-stream";
  }
}
export default function router() {
  return new Router()
}
