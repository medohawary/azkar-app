// Builds www/quran.json (mushaf text + surah index) and www/tafsir.json
// (المختصر في التفسير), both loaded lazily by the app and bundled for offline use.
const fs = require("fs");
const q = require("../data/quran-raw.json");
const tafsir = require("../data/tafsir-raw.json");

const clean = (t) => String(t).replace(/<[^>]*>/g, "").replace(/﻿/g, "").replace(/\s+/g, " ").trim();
// Taken from the data itself so the diacritic order always matches.
const BASMALA = clean(q.surahs[0].ayahs[0].text);

const surahs = [], ayahs = [], tafsirs = [];
q.surahs.forEach((s) => {
  const start = ayahs.length;
  s.ayahs.forEach((a, i) => {
    let text = clean(a.text);
    // Every surah but al-Fatiha and at-Tawba opens with the basmala prefixed to its first ayah.
    if (i === 0 && s.number !== 1 && s.number !== 9 && text.startsWith(BASMALA)) text = clean(text.slice(BASMALA.length));
    ayahs.push(text);
    tafsirs.push(clean((tafsir[s.number] || [])[i] || ""));
  });
  surahs.push({
    n: s.number,
    t: clean(s.name).replace(/^سُورَةُ\s*/, ""),
    c: s.ayahs.length,
    p: s.revelationType === "Meccan" ? "مكية" : "مدنية",
    s: start,
  });
});

const missing = tafsirs.filter((t) => !t).length;
if (ayahs.length !== 6236 || surahs.length !== 114) throw new Error(`bad counts ${ayahs.length}/${surahs.length}`);
if (missing > 5) throw new Error("tafsir missing for " + missing + " ayahs");
if (ayahs.some((a) => !a)) throw new Error("empty ayah");

fs.writeFileSync(__dirname + "/../www/quran.json", JSON.stringify({ surahs, ayahs }));
fs.writeFileSync(__dirname + "/../www/tafsir.json", JSON.stringify({ name: "المختصر في التفسير", by: "مركز تفسير للدراسات القرآنية", ayahs: tafsirs }));
const kb = (f) => Math.round(fs.statSync(__dirname + "/../www/" + f).size / 1024) + "KB";
console.log("quran.json", kb("quran.json"), "| tafsir.json", kb("tafsir.json"), "| ayahs", ayahs.length, "| tafsir gaps", missing);
