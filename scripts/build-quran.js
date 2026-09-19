// Builds the mushaf files the app loads on demand:
//   www/quran.json   — surahs, ayahs (Uthmani), juz / hizb / page indexes
//   www/tafsir.json  — المختصر في التفسير (Tafsir Center)
//   www/tafsir2.json — التفسير الميسر (King Fahd Complex)
const fs = require("fs");
const q = require("../data/quran-raw.json");
const mukhtasar = require("../data/tafsir-raw.json");
const muyassarRaw = require("../data/muyassar-raw.json");
const meta = require("../data/quran-meta.json").data;

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
    tafsirs.push(clean((mukhtasar[s.number] || [])[i] || ""));
  });
  surahs.push({
    n: s.number,
    t: clean(s.name).replace(/^سُورَةُ\s*/, ""),
    c: s.ayahs.length,
    p: s.revelationType === "Meccan" ? "مكية" : "مدنية",
    s: start,
  });
});

// Global ayah index (0-based) for a surah:ayah reference.
const at = (surah, ayah) => surahs[surah - 1].s + (ayah - 1);
const juz = meta.juzs.references.map((r, i) => ({ n: i + 1, s: at(r.surah, r.ayah) }));
const hizb = meta.hizbQuarters.references.filter((_, i) => i % 4 === 0).map((r, i) => ({ n: i + 1, s: at(r.surah, r.ayah) }));
const pages = meta.pages.references.map((r) => at(r.surah, r.ayah));

// التفسير الميسر, in the same flat ayah order.
const muyassar = [];
muyassarRaw.data.surahs.forEach((s) => s.ayahs.forEach((a) => muyassar.push(clean(a.text))));

if (ayahs.length !== 6236 || surahs.length !== 114) throw new Error(`bad counts ${ayahs.length}/${surahs.length}`);
if (juz.length !== 30 || hizb.length !== 60 || pages.length !== 604) throw new Error(`bad juz/hizb/pages ${juz.length}/${hizb.length}/${pages.length}`);
if (muyassar.length !== 6236) throw new Error("muyassar length " + muyassar.length);
if (ayahs.some((a) => !a) || muyassar.some((t) => !t)) throw new Error("empty text");
const gaps = tafsirs.filter((t) => !t).length;
if (gaps > 5) throw new Error("tafsir missing for " + gaps + " ayahs");

fs.writeFileSync(__dirname + "/../www/quran.json", JSON.stringify({ surahs, ayahs, juz, hizb, pages }));
fs.writeFileSync(__dirname + "/../www/tafsir.json", JSON.stringify({ name: "المختصر في التفسير", by: "مركز تفسير للدراسات القرآنية", ayahs: tafsirs }));
fs.writeFileSync(__dirname + "/../www/tafsir2.json", JSON.stringify({ name: "التفسير الميسر", by: "مجمع الملك فهد لطباعة المصحف الشريف", ayahs: muyassar }));
const kb = (f) => Math.round(fs.statSync(__dirname + "/../www/" + f).size / 1024) + "KB";
console.log("quran.json", kb("quran.json"), "| tafsir.json", kb("tafsir.json"), "| tafsir2.json", kb("tafsir2.json"),
  "| ayahs", ayahs.length, "| juz", juz.length, "| hizb", hizb.length, "| pages", pages.length);
