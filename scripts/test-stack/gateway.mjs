// Mini gateway (replaces Kong in tests): /auth/v1 → GoTrue, /rest/v1 → PostgREST.
// Like Supabase's gateway, it answers CORS so browser apps on another origin can call it.
import http from "node:http";

const routes = { "/auth/v1": 9999, "/rest/v1": 3001 };

function cors(req) {
  return {
    "Access-Control-Allow-Origin": req.headers.origin ?? "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] ?? "*",
    "Access-Control-Expose-Headers": "Content-Range, X-Total-Count",
    "Access-Control-Max-Age": "86400",
  };
}

http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(req)).end();
    return;
  }
  const prefix = Object.keys(routes).find((p) => req.url.startsWith(p));
  if (!prefix) {
    res.writeHead(404, cors(req)).end();
    return;
  }
  const up = http.request(
    { host: "127.0.0.1", port: routes[prefix], path: req.url.slice(prefix.length) || "/", method: req.method, headers: req.headers },
    (r) => {
      const headers = { ...r.headers };
      for (const k of Object.keys(headers)) if (k.toLowerCase().startsWith("access-control-")) delete headers[k];
      res.writeHead(r.statusCode, { ...headers, ...cors(req) });
      r.pipe(res);
    },
  );
  up.on("error", (e) => res.writeHead(502, cors(req)).end(String(e)));
  req.pipe(up);
}).listen(54321, () => console.log("gateway on 54321"));
