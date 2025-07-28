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

    if (pathParts.length !== routeParts.length) return null;

    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      // Handle compound param like ":start-:end"
      const paramMatch = [...routePart.matchAll(/:([a-zA-Z_][\w]*)/g)];
      if (paramMatch.length > 0) {
        const names = paramMatch.map((m) => m[1]);
        const regexStr = routePart.replace(/:([a-zA-Z_][\w]*)/g, "(.+)");
        const match = pathPart.match(new RegExp(`^${regexStr}$`));
        if (!match) return null;
        names.forEach((name, index) => {
          params[name] = decodeURIComponent(match[index + 1]);
        });
      } else if (routePart !== pathPart) {
        return null;
      }
    }

    return { params };
  }
}
    
