// Downloads the Quran (Uthmani script, Tanzil via alquran.cloud) and
// "المختصر في التفسير" (Tafsir Center for Quranic Studies, via spa5k/tafsir_api)
// into data/quran-raw.json + data/tafsir-raw.json.
const fs = require("fs");

const get = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "azkar-app/1.0 (open-source)" } });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("failed: " + url);
};

(async () => {
  const q = await get("https://api.alquran.cloud/v1/quran/quran-uthmani");
  fs.writeFileSync(__dirname + "/../data/quran-raw.json", JSON.stringify(q.data));
  console.log("quran surahs", q.data.surahs.length);

  const tafsir = {};
  for (let s = 1; s <= 114; s++) {
    const j = await get(`https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/ar-tafsir-al-mukhtasar/${s}.json`);
    tafsir[s] = (j.ayahs || j).map((a) => a.text);
    if (s % 20 === 0) console.log("tafsir surah", s);
  }
  fs.writeFileSync(__dirname + "/../data/tafsir-raw.json", JSON.stringify(tafsir));
  console.log("tafsir ayahs", Object.values(tafsir).reduce((a, x) => a + x.length, 0));
})();
