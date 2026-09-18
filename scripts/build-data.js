// Builds www/data.js (and www/content.json for over-the-air updates) from:
//   data/raw.json            — Hisn al-Muslim (rn0x/Adhkar-json)
//   data/morning-evening.json — morning/evening adhkar, already split (Seen-Arabic/Morning-And-Evening-Adhkar-DB)
const fs = require("fs");
const raw = require("../data/raw.json");
const me = require("../data/morning-evening.json");
const hadithTopics = require("../data/hadiths-raw.json");

const CONTENT_VERSION = 3; // bump whenever the adhkar/groups/home change

const fixTitle = (t) =>
  t.replace(/[ﹰ-﻿ﭐ-﷿]+/g, (m) => m.normalize("NFKC"))
   .replace("مترلا", "منزلا").replace(/ُ\s?(?=[لغ])/g, "").replace(/\s+/g, " ").trim();
const clean = (t) => t.replace(/\s+/g, " ").trim();

// Repetitions stated inside the text but missing from the source's count field.
const COUNT_FIXES = { 31: 3, 33: 3, 37: 3, 49: 7 };

const MORNING_ID = 133, EVENING_ID = 134;

const groups = [
  ["daily", "أذكار اليوم والليلة", "☀️", [MORNING_ID, EVENING_ID, 2, 3, 29, 30, 31, 129, 130, 131, 107]],
  ["prayer", "الصلاة", "🕌", [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 32, 33]],
  ["tahara", "الطهارة والمسجد والأذان", "💧", [4, 5, 6, 7, 10, 11, 12, 13]],
  ["home", "البيت واللباس والطعام", "🏠", [8, 9, 14, 15, 16, 17, 47, 48, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81]],
  ["distress", "الهم والكرب والتحصين", "🤲", [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 82, 88, 92, 94, 124, 125, 126, 128]],
  ["sick", "المرض والموت", "🌿", [49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 83]],
  ["nature", "المطر والرياح والهلال", "🌧️", [61, 62, 63, 64, 65, 66, 67]],
  ["travel", "السفر والحج والعمرة", "🧭", [95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 115, 116, 117, 118, 119, 120, 121, 127]],
  ["social", "المعاملات والآداب", "🤝", [84, 85, 86, 87, 89, 90, 91, 93, 106, 108, 109, 110, 111, 112, 113, 114, 122, 123, 132]],
];

// Home screen: quick buttons, and the greeting that changes with the hour.
const home = {
  quick: [
    ["🌅", "أذكار الصباح", MORNING_ID],
    ["🌇", "أذكار المساء", EVENING_ID],
    ["🌙", "أذكار النوم", 2],
    ["🕌", "بعد الصلاة", 27],
    ["⏰", "الاستيقاظ", 3],
    ["🤍", "الاستغفار", 129],
  ],
  // [fromHour, toHour, greeting, line, categoryId]
  greetings: [
    [3, 12, "صباح الخير", "حان وقت أذكار الصباح", MORNING_ID],
    [12, 15, "طاب يومك", "هل قرأت الأذكار بعد الصلاة؟", 27],
    [15, 21, "مساء الخير", "حان وقت أذكار المساء", EVENING_ID],
    [21, 3, "تصبح على خير", "أذكار النوم قبل أن تنام", 2],
  ],
};

// --- Hisn al-Muslim chapters (the old combined morning/evening chapter is replaced below) ---
const cats = raw.filter((c) => c.id !== 1).map((c) => ({
  id: c.id,
  t: fixTitle(c.category),
  z: c.array.map((z) => {
    let count = z.count || 1;
    const fix = COUNT_FIXES[c.id];
    if (fix && count === 1 && /\(?\s*(ثلاث|سبع)\s*مرات\s*\)?/.test(z.text.replace(/[ً-ٰٟـ]/g, ""))) count = fix;
    return [clean(z.text), count];
  }),
}));

// --- Morning / evening, each on its own page (type 0 = both, 1 = morning only, 2 = evening only) ---
const pick = (types) => me
  .filter((x) => types.includes(x.type))
  .sort((a, b) => a.order - b.order)
  .map((x) => [clean(x.content), x.count || 1]);

cats.push({ id: MORNING_ID, t: "أذكار الصباح", z: pick([0, 1]) });
cats.push({ id: EVENING_ID, t: "أذكار المساء", z: pick([0, 2]) });

// --- Hadiths: only what the encyclopedia itself grades صحيح and traces to al-Bukhari/Muslim ---
const authentic = (h) =>
  h.grade === "صحيح" &&
  /^(متفق عليه|رواه البخاري|رواه مسلم|رواه البخاري ومسلم)\.?$/.test((h.attribution || "").trim()) &&
  typeof h.explanation === "string" && h.explanation.length > 50 &&
  typeof h.hadeeth === "string" && h.hadeeth.length > 30;

const hadiths = { topics: [], items: [] };
hadithTopics.forEach((t) => {
  const kept = t.items.filter(authentic).slice(0, t.take);
  if (!kept.length) return;
  hadiths.topics.push({ k: "t" + t.id, t: t.title, i: t.icon, ids: kept.map((h) => +h.id) });
  kept.forEach((h) => hadiths.items.push({
    id: +h.id,
    t: clean(h.title),
    h: clean(h.hadeeth),
    a: clean(h.attribution),
    g: clean(h.grade),
    e: clean(h.explanation),
    f: (h.hints || []).map(clean).filter(Boolean),
    r: (h.reference || "").split("\n").map(clean).filter(Boolean).slice(0, 2),
    u: "https://hadeethenc.com/ar/browse/hadith/" + h.id,
  }));
});
if (hadiths.items.some((h) => !authentic({ grade: h.g, attribution: h.a, explanation: h.e, hadeeth: h.h }))) throw new Error("ungraded hadith slipped through");

const used = groups.flatMap((g) => g[3]);
const missing = cats.map((c) => c.id).filter((id) => !used.includes(id));
const unknown = used.filter((id) => !cats.some((c) => c.id === id));
const dup = used.filter((id, i) => used.indexOf(id) !== i);
if (missing.length || unknown.length || dup.length) throw new Error(`missing ${missing} unknown ${unknown} dup ${dup}`);

const out = { v: CONTENT_VERSION, groups: groups.map(([k, t, i, ids]) => ({ k, t, i, ids })), home, cats, hadiths };
fs.writeFileSync(__dirname + "/../www/data.js", "window.AZKAR=" + JSON.stringify(out) + ";");
fs.writeFileSync(__dirname + "/../www/content.json", JSON.stringify(out));
console.log("content v" + CONTENT_VERSION, "hadiths", hadiths.items.length, "in", hadiths.topics.length, "topics,", "cats", cats.length, "items", cats.reduce((a, c) => a + c.z.length, 0),
  "morning", pick([0, 1]).length, "evening", pick([0, 2]).length,
  "bytes", fs.statSync(__dirname + "/../www/data.js").size);
