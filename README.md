# أذكار المسلم

تطبيق موبايل خفيف فيه **حصن المسلم كامل** (132 باب — 267 ذكر)، يعمل بدون إنترنت.

- الحجم كله ≈ 140KB (بدون مكتبات ولا خطوط خارجية).
- عدّاد تفاعلي لكل ذكر مع اهتزاز وانتقال تلقائي للذكر التالي وشريط تقدّم، ويُحفظ تقدّم اليوم.
- بحث في كل الأذكار (يتجاهل التشكيل)، مفضلة، نسخ ومشاركة.
- سبحة إلكترونية (٣٣ / ١٠٠ / ١٠٠٠ / بلا حد).
- وضع ليلي، تكبير الخط، اقتراح الأذكار حسب الوقت.

## التشغيل محليًا
    npm start        # http://localhost:5391

## تثبيته على الموبايل
1. **كتطبيق ويب (PWA):** ارفع مجلد `www` على أي استضافة (Vercel/Netlify)، افتحه من الموبايل ← "إضافة إلى الشاشة الرئيسية".
2. **كـ APK للأندرويد:** يحتاج Android Studio:
       npm run android:init
       npm run android:open   # ثم Build > Build APK
   وبعد أي تعديل: `npm run android:sync`.

## البيانات
مصدر النصوص: [rn0x/Adhkar-json](https://github.com/rn0x/Adhkar-json) (حصن المسلم). لإعادة بناء `www/data.js`: `npm run data`.

## نشر تحديث جديد
التطبيق المثبّت يتحقق عند فتحه (لو فيه إنترنت) من `version.json` ويُظهر شريط «يوجد تحديث جديد».

    node scripts/release.js 1.3 "ملاحظات التحديث"
    ANDROID_HOME=~/android-build/sdk JAVA_HOME=$(ls -d ~/android-build/jdk-*/Contents/Home) npm run android:build
    node scripts/build-single.js
    cp android/app/build/outputs/apk/release/app-release.apk www/azkar.apk
    cd www && npx vercel deploy --prod
