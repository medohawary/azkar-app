// Builds www/azkar-offline.html: one self-contained file that works with no internet (open it directly).
const fs = require("fs"), w = (f) => fs.readFileSync(__dirname + "/../www/" + f, "utf8");
const icon = "data:image/svg+xml;base64," + Buffer.from(w("icon.svg")).toString("base64");
const html = w("index.html")
  .replace(/<link rel="manifest"[^>]*>\n?/, "")
  .replace(/<link rel="(icon|apple-touch-icon)"[^>]*>/g, `<link rel="icon" href="${icon}">`)
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>${w("style.css")}</style>`)
  .replace('<script src="data.js"></script>', () => `<script>${w("data.js")}</script>`)
  .replace('<script src="app.js"></script>', () => `<script>${w("app.js")}</script>`);
fs.writeFileSync(__dirname + "/../www/azkar-offline.html", html);
console.log("bytes", html.length);
