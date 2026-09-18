// Fetches hadiths + their explanations from the scholarly encyclopedia HadeethEnc
// (hadeethenc.com) into data/hadiths-raw.json. Only what the source itself grades is stored;
// the filtering to صحيح / متفق عليه happens in build-data.js.
const fs = require("fs");
const OUT = __dirname + "/../data/hadiths-raw.json";

const TOPICS = [
  [282, "الأخلاق الحميدة", "🤝", 14],
  [267, "الآداب الشرعية", "🌸", 14],
  [269, "الرقائق والمواعظ", "🌿", 14],
  [277, "فضائل الأعمال الصالحة", "⭐", 12],
  [457, "فضل الصلاة", "🕌", 12],
  [513, "فضل الصيام", "🌙", 8],
  [311, "آداب الدعاء", "🤲", 10],
  [321, "التوبة والاستغفار", "🤍", 12],
  [273, "بر الوالدين وصلة الرحم", "👪", 12],
  [270, "فضل العلم", "📖", 10],
];

const get = async (url) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "azkar-app/1.0 (open-source)" } });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("failed: " + url);
};

(async () => {
  const out = [];
  for (const [id, title, icon, take] of TOPICS) {
    const list = await get(`https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id=${id}&page=1&per_page=${take * 3}`);
    const items = [];
    for (const row of list.data || []) {
      if (items.length >= take * 2) break;
      const h = await get(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${row.id}`);
      items.push(h);
      await new Promise((r) => setTimeout(r, 250));
    }
    out.push({ id, title, icon, take, items });
    console.log(title, items.length);
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log("saved", out.reduce((a, t) => a + t.items.length, 0), "hadiths");
})();
