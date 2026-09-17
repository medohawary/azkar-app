// Builds www/data.js from data/raw.json (Hisn al-Muslim, rn0x/Adhkar-json)
const fs = require("fs");
const raw = require("../data/raw.json");

const fixTitle = (t) =>
  t.replace(/[ﹰ-﻿ﭐ-﷿]+/g, (m) => m.normalize("NFKC"))
   .replace("مترلا", "منزلا").replace(/ُ\s?(?=[لغ])/g, "").replace(/\s+/g, " ").trim();

const groups = [
  ["daily", "أذكار اليوم والليلة", "☀️", [1, 2, 3, 29, 30, 31, 129, 130, 131, 107]],
  ["prayer", "الصلاة", "🕌", [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 32, 33]],
  ["tahara", "الطهارة والمسجد والأذان", "💧", [4, 5, 6, 7, 10, 11, 12, 13]],
  ["home", "البيت واللباس والطعام", "🏠", [8, 9, 14, 15, 16, 17, 47, 48, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81]],
  ["distress", "الهم والكرب والتحصين", "🤲", [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 82, 88, 92, 94, 124, 125, 126, 128]],
  ["sick", "المرض والموت", "🌿", [49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 83]],
  ["nature", "المطر والرياح والهلال", "🌧️", [61, 62, 63, 64, 65, 66, 67]],
  ["travel", "السفر والحج والعمرة", "🧭", [95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 115, 116, 117, 118, 119, 120, 121, 127]],
  ["social", "المعاملات والآداب", "🤝", [84, 85, 86, 87, 89, 90, 91, 93, 106, 108, 109, 110, 111, 112, 113, 114, 122, 123, 132]],
];

const used = groups.flatMap((g) => g[3]);
const missing = raw.map((c) => c.id).filter((id) => !used.includes(id));
const dup = used.filter((id, i) => used.indexOf(id) !== i);
if (missing.length || dup.length) throw new Error(`missing ${missing} dup ${dup}`);

const cats = raw.map((c) => ({
  id: c.id,
  t: fixTitle(c.category),
  z: c.array.map((z) => [z.text.replace(/\s+/g, " ").trim(), z.count || 1]),
}));

const out = { groups: groups.map(([k, t, i, ids]) => ({ k, t, i, ids })), cats };
fs.writeFileSync(__dirname + "/../www/data.js", "window.AZKAR=" + JSON.stringify(out) + ";");
console.log("cats", cats.length, "items", cats.reduce((a, c) => a + c.z.length, 0), "bytes", fs.statSync(__dirname + "/../www/data.js").size);
