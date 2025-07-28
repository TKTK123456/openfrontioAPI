export class Router {
  constructor() {
    this.routes = [];
  }

  get(path, handler) {
    this.routes.push({ method: "GET", path, handler });
  }

  post(path, handler) {
    this.routes.push({ method: "POST", path, handler });
  }

  async handle(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = this.#matchRoute(pathname, route.path);
      if (match) {
        const { params } = match;
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
          params,
          query,
          body,
          send: (data, options = {}) => {
            ctx.res = new Response(
              typeof data === "string" ? data : JSON.stringify(data),
              {
                status: options.status || 200,
                headers: {
                  "content-type":
                    options.type ||
                    (typeof data === "string"
                      ? "text/plain"
                      : "application/json"),
                  ...options.headers,
                },
              }
            );
          },
        };

        await route.handler(ctx);
        return ctx.res || new Response("No response", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  #matchRoute(pathname, routePath) {
  const pathParts = pathname.split("/").filter(Boolean);
  const routeParts = routePath.split("/").filter(Boolean);

  if (pathParts.length > routeParts.length) return null;

  const params = {};

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];

    // Handle optional group like ":start{-:end}"
    if (routePart.includes("{")) {
      const [main, group] = routePart.split("{");
      const groupContent = group.slice(0, -1); // Remove trailing "}"

      const paramMatches = [...(main + groupContent).matchAll(/:([\w]+)/g)];
      const names = paramMatches.map(m => m[1]);

      // Build a regex like `:start{-:end}` => `(.+)?(?:-(.+))?`
      const regexStr = (main + groupContent)
        .replace(/:([\w]+)/g, (_, name) => `(?<${name}>[^/]+)`);

      const fullRegex = new RegExp(`^${regexStr}$`);
      const match = pathPart.match(fullRegex);
      if (!match || !match.groups) return null;

      for (const name of names) {
        if (match.groups[name] !== undefined) {
          params[name] = decodeURIComponent(match.groups[name]);
        }
      }
    }
    // Normal parameter or static
    else if (routePart.startsWith(":")) {
      const name = routePart.slice(1);
      params[name] = decodeURIComponent(pathPart);
    } else if (routePart !== pathPart) {
      return null;
    }
  }

  return { params };
  }
  
}
    
