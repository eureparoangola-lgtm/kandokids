// Mini gateway (replaces Kong in tests): /auth/v1 → GoTrue, /rest/v1 → PostgREST
import http from "node:http";
const routes = { "/auth/v1": 9999, "/rest/v1": 3001 };
http.createServer((req, res) => {
  const prefix = Object.keys(routes).find((p) => req.url.startsWith(p));
  if (!prefix) { res.writeHead(404).end(); return; }
  const up = http.request({ host: "127.0.0.1", port: routes[prefix], path: req.url.slice(prefix.length) || "/",
    method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on("error", (e) => { res.writeHead(502).end(String(e)); });
  req.pipe(up);
}).listen(54321, () => console.log("gateway on 54321"));
