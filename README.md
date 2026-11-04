# جمعية الأسرة السعيدة · Den Glada Familjen

موقع تعريفي (Landing Page) ثنائي اللغة لجمعية **الأسرة السعيدة / Föreningen Den Glada Familjen** في فيستيروس، السويد.

الموقع مبني باستخدام **Astro** كموقع ثابت (Static Site) وجاهز للنشر على **Cloudflare Pages**.

---

## المحتوى

- صفحة عربية رئيسية على `/` (RTL)
- صفحة سويدية على `/sv/` (LTR)
- تبديل اللغة في الهيدر والقائمة
- تصميم Mobile First يعمل على الهاتف والتابلت والكمبيوتر
- أقسام: الواجهة الرئيسية، القيم، من نحن، الأنشطة، الشعار، المعرض، الانضمام، الأسئلة الشائعة، التواصل
- أزرار واتساب، بريد إلكتروني، يوتيوب، تيك توك
- نموذج تواصل يفتح تطبيق البريد الإلكتروني (`mailto:`) بدون خادم
- SEO: عناوين ووصف، Open Graph، Sitemap، Robots، JSON-LD، hreflang
- أداء وأمان: صور محسّنة، خطوط محلية، CSP وHeaders على Cloudflare
- إتاحة: Skip link، تركيز واضح، احترام `prefers-reduced-motion`، HTML دلالي

---

## التشغيل محليًا

يتطلب **Node.js 22.23.4 أو أحدث**.

```bash
npm install
npm run dev
```

ثم افتح:

- العربية: http://localhost:4321/
- السويدية: http://localhost:4321/sv/

### أوامر مفيدة

```bash
npm run check    # فحص TypeScript وأخطاء Astro
npm run build    # بناء الموقع إلى مجلد dist/
npm run preview  # معاينة نسخة الإنتاج محليًا
```

---

## تعديل المحتوى

| الملف | الاستخدام |
| --- | --- |
| `src/i18n/ar.ts` | كل النصوص العربية |
| `src/i18n/sv.ts` | كل النصوص السويدية |
| `src/data/site.ts` | البريد، الهاتف، واتساب، يوتيوب، تيك توك، رقم التسجيل |
| `src/styles/global.css` | الهوية البصرية، الألوان، المسافات، التجاوب |
| `src/assets/images/` | الصور والشعار |
| `public/` | الأيقونات، صور OG، `_headers`، `_redirects` |
| `src/pages/` | الصفحات ونقطة `robots.txt` |

### الروابط الأساسية

- الموقع: `/` للعربية و `/sv/` للسويدية
- `/ar` و `/ar/*` يتم تحويلهما إلى الصفحة العربية عبر `public/_redirects`

### تغيير اسم النطاق

قبل النشر على نطاق مخصص:

1. عدّل `SITE` داخل `astro.config.mjs` (سيتحدّث رابط Sitemap في `robots.txt` تلقائيًا).
2. أعد توليد أو عدّل النص الصغير في `public/og-image-ar.jpg` و`public/og-image-sv.jpg` (يحتويان حاليًا على `dgf-vaesteras.pages.dev`).

---

## النشر على Cloudflare Pages

### الطريقة 1: عبر لوحة Cloudflare (موصى بها)

1. ارفع المشروع إلى GitHub أو GitLab.
2. من Cloudflare Dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. اختر المستودع.
4. الإعدادات:
   - **Framework preset:** Astro (أو None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION = 22.23.4`
5. اضغط **Save and Deploy**.

### الطريقة 2: عبر Wrangler CLI

```bash
npm run build
npx wrangler pages deploy dist --project-name dgf-vaesteras
```

### النطاق المخصص

بعد نجاح أول نشر:

1. من مشروع Pages: **Custom domains → Set up a custom domain**.
2. أضف النطاق واتبع تعليمات DNS.
3. عدّل `SITE` في `astro.config.mjs` إلى النطاق النهائي ثم أعد النشر.

> ملاحظة: ملف `public/_headers` يضيف ترويسات أمان وCSP، وملف `public/_redirects` يعالج روابط `/ar`.

---

## ملاحظات مهمة

- **الصور:** الصور الفوتوغرافية (البطل، من نحن، المعرض) صور تعبيرية من [Pexels](https://www.pexels.com/) (مرخّصة للاستخدام المجاني). يُفضّل استبدالها بصور حقيقية من أنشطة الجمعية عند توفرها. الشعار ملك الجمعية.
- **نموذج التواصل:** لا يوجد خادم أو قاعدة بيانات. النموذج يفتح تطبيق البريد الإلكتروني لدى الزائر عبر `mailto:`. إذا رغبتم بنموذج حقيقي، اربطوه بـ Formspree أو Cloudflare Worker أو خدمة مشابهة.
- **الخصوصية:** الموقع لا يستخدم كوكيز أو أدوات تتبّع، والخطوط مستضافة محليًا. أضيفوا سياسة خصوصية منفصلة إذا أضفتم تحليلات لاحقًا.
- **البيانات:** رقم التسجيل `802527-6026` والبريد والهاتف مأخوذة من الصفحة الحالية للجمعية ومن السجلات العامة. راجعوا صحتها قبل النشر النهائي.
- **الترجمة:** النصوص السويدية والعربية مكتوبة يدويًا؛ يُنصح بمراجعة لغوية سريعة من متحدث أصلي قبل الإطلاق.

---

## بنية المشروع

```text
/
├── public/                 # ملفات ثابتة (أيقونات، OG، headers, redirects)
├── src/
│   ├── assets/images/      # الشعار والصور
│   ├── components/         # أقسام الصفحة والمكونات
│   ├── data/site.ts        # بيانات التواصل والروابط
│   ├── i18n/               # القواميس العربية والسويدية
│   ├── layouts/            # القالب الأساسي
│   ├── pages/              # / و /sv/
│   └── styles/             # الخطوط والتصميم
├── astro.config.mjs
├── package.json
└── README.md
```

---

## الترخيص

الكود مخصص لجمعية الأسرة السعيدة. الصور الفوتوغرافية من Pexels وفق ترخيص Pexels. الشعار وحقوقه ملك الجمعية.
