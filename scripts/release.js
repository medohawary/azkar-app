// Bump the app version everywhere: node scripts/release.js 1.3 "ملاحظات التحديث"
const fs = require("fs"), path = require("path");
const [name, notes = ""] = process.argv.slice(2);
if (!/^\d+\.\d+$/.test(name || "")) throw new Error('usage: node scripts/release.js 1.3 "notes"');
const root = path.join(__dirname, ".."), f = (p) => path.join(root, p);

let app = fs.readFileSync(f("www/app.js"), "utf8");
const code = +app.match(/APP_VERSION = \{ code: (\d+)/)[1] + 1;
fs.writeFileSync(f("www/app.js"), app.replace(/APP_VERSION = \{ code: \d+, name: "[^"]*" \}/, `APP_VERSION = { code: ${code}, name: "${name}" }`));

let gradle = fs.readFileSync(f("android/app/build.gradle"), "utf8");
fs.writeFileSync(f("android/app/build.gradle"), gradle.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${name}"`));

fs.writeFileSync(f("www/version.json"), JSON.stringify({ code, name, notes, url: "https://azkar-hisn-almuslim.vercel.app/azkar.apk" }, null, 2) + "\n");
console.log(`version ${name} (code ${code})`);
