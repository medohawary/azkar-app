// Tiny static server for local preview: node scripts/serve.js [port]
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "www"), port = +process.argv[2] || 5391;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(root)) return res.writeHead(403).end();
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(p, (err, data) => {
    if (err) return res.writeHead(404).end("not found");
    res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }).end(data);
  });
}).listen(port, () => console.log("http://localhost:" + port));
