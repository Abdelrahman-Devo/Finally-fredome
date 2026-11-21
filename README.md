# الحرية النهائية – FINAL FREEDOM

تطبيق مالي شخصي (PWA) يعمل دون إنترنت، بياناته محفوظة على جهازك في IndexedDB.

## التشغيل السريع
- **أسهل طريقة:** ارفع مجلد المشروع كما هو على أي استضافة HTTPS مجانية (Netlify Drop / GitHub Pages / Cloudflare Pages)، افتح الرابط في Chrome على أندرويد ← ⋮ ← «تثبيت التطبيق / Add to Home screen».
- محليًا: `python3 -m http.server 8000` ثم افتح `http://localhost:8000`.
- نسخة الملف الواحد `final-freedom.html` تعمل بفتحها مباشرة (بدون وضع التثبيت/العمل دون إنترنت).

## الحصول على APK (Capacitor)
```bash
npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "الحرية النهائية" com.finalfreedom.app --web-dir=.
npx cap add android && npx cap sync && npx cap open android   # Build > Build APK في Android Studio
```
أو ارفع الرابط المستضاف إلى pwabuilder.com لتوليد APK/AAB جاهز.

## الهيكل
- `js/core.js` منطق الحسابات (بدون واجهة) • `js/db.js` التخزين • `js/app.js` الواجهة
- `tests/core.test.js` اختبارات الحسابات: `node tests/core.test.js`

## النموذج المحاسبي
كل حركة مالية سجل واحد (من ← إلى). الرصيد = الوارد − الصادر لكل بند، فالتحويل لا يخلق دخلًا ولا مصروفًا ولا يضاعف الثروة.
صافي الثروة = النقد (البنود + الأهداف + غير الموزع) + الأصول − الديون.
