# جمعية الأسرة السعيدة · Den Glada Familjen

موقع تعريفي (Landing Page) ثنائي اللغة لجمعية **الأسرة السعيدة / Föreningen Den Glada Familjen** في فيستيروس، السويد.

الموقع مبني باستخدام **Astro** كموقع ثابت (Static Site) وجاهز للنشر على **Cloudflare Pages**، مع لوحة تحكم محمية على `/admin/` تعدّل ملفات Markdown والصور مباشرة عبر GitHub — **بدون أي قاعدة بيانات**.

---

## المحتوى

- صفحة عربية رئيسية على `/` (RTL)
- صفحة سويدية على `/sv/` (LTR)
- تبديل اللغة في الهيدر والقائمة
- تصميم Mobile First يعمل على الهاتف والتابلت والكمبيوتر
- أقسام: الواجهة الرئيسية، القيم، من نحن، الأنشطة، اللقاء الأسبوعي، الشعار، المعرض، الانضمام، الأسئلة الشائعة، التواصل
- صفحة أسبوعية مستقلة: `/meetings/` و`/sv/moten/` تعرض لقاءات الأحد بتسلسل زمني (Timeline) مع المواضيع، الملخصات، الصور، والفيديو، وخريطة ثابتة خفيفة للموقع
- أزرار واتساب، بريد إلكتروني، يوتيوب، تيك توك
- نموذج تواصل يفتح تطبيق البريد الإلكتروني (`mailto:`) بدون خادم
- SEO: عناوين ووصف، Open Graph، Sitemap، Robots، JSON-LD، hreflang
- أداء وأمان: صور محسّنة، خطوط محلية، CSP وHeaders على Cloudflare
- إتاحة: Skip link، تركيز واضح، احترام `prefers-reduced-motion`، HTML دلالي
- **لوحة تحكم** عربية على `/admin/` لتعديل النصوص والصور واللقاءات

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

> `npm run dev` يشغّل الموقع فقط. لوحة التحكم تحتاج Functions، لذا استخدم `npm run dev:cf` (انظر أدناه).

### أوامر مفيدة

```bash
npm run check        # فحص TypeScript وأخطاء Astro
npm run build        # بناء الموقع إلى مجلد dist/
npm run preview      # معاينة نسخة الإنتاج الثابتة محليًا
npm run admin:hash   # توليد hash لكلمة سر لوحة التحكم
npm run dev:cf       # بناء + تشغيل Cloudflare Pages Functions محليًا
npm run preview:cf   # تشغيل dist الحالي مع Functions
```

---

## لوحة التحكم `/admin/`

### كيف تعمل؟

```text
/admin (المتصفح)
   ↓  تسجيل دخول + جلسة HttpOnly
Pages Function (Worker)
   ↓  GitHub API
commit إلى المستودع (ملفات MD + الصور)
   ↓
Cloudflare Pages تعيد البناء تلقائيًا
   ↓
الموقع المحدّث خلال 1–2 دقيقة
```

**مهم:** Cloudflare Pages لا يسمح بتعديل ملفات الموقع بعد النشر؛ لذلك لا يعدّل الـ Worker ملفات `dist` مباشرة. هو يعدّل **ملفات المستودع على GitHub**، ثم يعيد Cloudflare بناء الموقع من جديد. لا يوجد KV أو R2 أو D1.

### المتطلبات

1. مشروع Cloudflare Pages مرتبط بمستودع GitHub (Git integration) حتى يبدأ البناء تلقائيًا بعد كل commit.
2. GitHub Fine-grained PAT بصلاحية **Contents: Read and write** على المستودع.
3. اسم مستخدم وكلمة سر قوية للوحة التحكم.

### 1) إنشاء GitHub Token

1. افتح GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. اختر **Generate new token**.
3. **Repository access:** Only select repositories → `eramax/Den-Glada-Familjen`.
4. **Permissions → Repository permissions:**
   - **Contents:** Read and write
   - **Metadata:** Read-only (تلقائي)
5. اختر مدة صلاحية مناسبة (سنة مثلًا) وفعّل تذكيرًا لتجديده.
6. انسخ التوكن. لن يظهر مرة أخرى.

لا ترسل التوكن في المحادثة أو تضعه في الكود. ضعه فقط في Secrets الخاصة بـ Cloudflare.

### 2) توليد hash لكلمة السر

```bash
npm run admin:hash -- "كلمة-سر-طويلة-وقوية"
```

سيطبع سطرًا مثل:

```text
pbkdf2-sha256$50000$...$...
```

انسخ السطر كاملًا إلى `ADMIN_PASSWORD_HASH`.

- استخدم **16 حرفًا أو أكثر**، ويفضل عبارة مرور طويلة.
- لا تُحفظ كلمة السر نفسها في أي مكان؛ يُحفظ الـ hash فقط.
- 50,000 تكرار مناسبة للخطة المجانية على Workers. إذا انتقلت إلى خطة مدفوعة يمكنك توليد hash أقوى:
  ```bash
  PBKDF2_ITERATIONS=210000 npm run admin:hash -- "كلمة-سر-طويلة"
  ```
  الخادم يقرأ عدد التكرارات من الـ hash نفسه، فلا حاجة لتعديل الكود.

### 3) إضافة المتغيرات في Cloudflare Pages

من مشروع Pages: **Settings → Environment variables → Production** (وأضفها إلى Preview أيضًا إذا رغبت):

| المتغير | القيمة | سري؟ |
| --- | --- | --- |
| `NODE_VERSION` | `22.23.4` | لا |
| `ADMIN_USER` | اسم المستخدم الذي تختاره | لا |
| `ADMIN_PASSWORD_HASH` | السطر الناتج من `npm run admin:hash` | **نعم** |
| `AUTH_SECRET` | سلسلة عشوائية طويلة (مثل `openssl rand -base64 48`) | **نعم** |
| `GITHUB_TOKEN` | GitHub Fine-grained PAT | **نعم** |
| `GITHUB_REPO` | `eramax/Den-Glada-Familjen` (اختياري) | لا |
| `GITHUB_BRANCH` | `main` (اختياري) | لا |
| `SESSION_HOURS` | `12` (اختياري) | لا |
| `SITE_URL` | النطاق المخصص (اختياري) | لا |

بعد إضافة المتغيرات اضغط **Save** ثم **Create deployment** (أو أعد النشر) حتى تُطبَّق.

### 4) الاستخدام

1. افتح `https://den-glada-familjen.pages.dev/admin/`.
2. سجّل الدخول باسم المستخدم وكلمة السر.
3. اختر التبويب:
   - **الرئيسية:** نصوص الصفحة الرئيسية (الواجهة، من نحن، الأنشطة، المعرض، التواصل...).
   - **اللقاءات:** إضافة/تعديل/حذف لقاء أسبوعي وصوره.
   - **صفحة اللقاءات:** موعد اللقاء، المكان، نصوص الأرشيف.
   - **الهوية والتنقل:** اسم الجمعية، القائمة، الفوتر، نصوص إمكانية الوصول.
   - **الصور:** استبدال صور الأقسام الثابتة.
4. عدّل العربية أو السويدية من تبويب اللغة داخل المحرر.
5. اضغط **حفظ ونشر**. سيُنشأ commit في GitHub، ثم يبدأ Cloudflare البناء.
6. انتظر 1–2 دقيقة وحدّث الموقع.

> الحفظ يظهر في GitHub فورًا، لكن الموقع المنشور يتحدّث بعد انتهاء البناء. إذا فشل البناء، يبقى آخر نشر ناجح ظاهرًا.

### تشغيل لوحة التحكم محليًا

```bash
cp .dev.vars.example .dev.vars
```

املأ `.dev.vars` بقيم حقيقية (أو قيم تجريبية)، ثم:

```bash
npm run dev:cf
```

افتح: `http://localhost:8787/admin/`

- `npm run dev:cf` يبني الموقع ثم يشغّل `wrangler pages dev dist` مع Functions.
- `npm run dev` العادي لا يشغّل الـ API.
- `.dev.vars` مستثنى من Git. لا ترفعه.
- لاستخدام GitHub الحقيقي محليًا، ضع `GITHUB_TOKEN` الحقيقي في `.dev.vars` ولا تضبط `GITHUB_API_BASE`.

### الأمان

- كلمة السر تُخزَّن كـ **PBKDF2-SHA256** وليست نصًا.
- الجلسة موقعة بـ **HMAC-SHA256** في كوكي `HttpOnly` + `SameSite=Strict`، وتنتهي بعد 12 ساعة افتراضيًا.
- حماية CSRF عبر فحص `Origin` وترويسة `X-Requested-With`.
- Rate limiting: 5 محاولات دخول فاشلة لكل IP خلال 15 دقيقة (أفضل جهد داخل الـ isolate).
- مسارات الملفات محددة بقائمة سماح؛ لا يمكن الوصول إلى ملفات خارج `src/content` و`src/assets/images`.
- رفع الصور: JPG/PNG/WebP فقط، فحص magic bytes، وحد أقصى 4MB، مع ضغط تلقائي في المتصفح.
- GitHub token لا يصل إلى المتصفح أبدًا.
- لوحة `/admin/` مستثناة من Sitemap و`robots.txt` وتحمل `noindex`.

**ملاحظات أمان:**
- استخدم كلمة سر طويلة وفريدة، وفعّل 2FA على GitHub.
- إذا تسرّب `GITHUB_TOKEN`، أبطله فورًا من GitHub وأنشئ آخر.
- تغيير `AUTH_SECRET` يُبطل كل الجلسات الحالية (يحتاج المدير لتسجيل الدخول من جديد).
- كوكي الجلسة تخص المدير فقط؛ زوار الموقع لا يحصلون على كوكيز.
- لا يوجد قفل مركزي للمحاولات عبر كل الـ isolates؛ لا تعتمد على Rate limiting وحده.

### استكشاف الأخطاء

| المشكلة | السبب المحتمل | الحل |
| --- | --- | --- |
| «لم تُضبط إعدادات الدخول» | متغيرات ناقصة في Cloudflare | أضف `ADMIN_USER` و`ADMIN_PASSWORD_HASH` و`AUTH_SECRET` ثم أعد النشر |
| «تعذّر الوصول إلى GitHub» | التوكن غير صالح أو بلا صلاحية Contents | أنشئ PAT جديدًا بصلاحية Contents: Read and write |
| «تم تعديل الملف من مكان آخر» | تعديل متزامن | أعد تحميل الصفحة ثم أعد الحفظ |
| «الملف غير موجود» | ملف MD محذوف أو مسار خاطئ | تحقق من `src/content/` في GitHub |
| الحفظ ينجح لكن الموقع لا يتحدّث | Pages غير مرتبط بـ GitHub | فعّل Git integration أو أعد النشر يدويًا |
| فشل البناء بعد الحفظ | خطأ في المحتوى | افتح commit على GitHub، صحّح الملف أو ارجع للنسخة السابقة |

---

## تعديل المحتوى

المحتوى الآن في ملفات Markdown داخل `src/content/`، ولوحة `/admin/` هي الطريقة الموصى بها لتعديله. يمكنك أيضًا تعديل الملفات مباشرة على GitHub.

| الملف | الاستخدام |
| --- | --- |
| `src/content/pages/home.md` | نصوص الصفحة الرئيسية (ar + sv) |
| `src/content/pages/meetings.md` | نصوص صفحة اللقاءات (ar + sv) |
| `src/content/pages/site.md` | الهوية، القائمة، الفوتر، إمكانية الوصول (ar + sv) |
| `src/content/meetings/YYYY-MM-DD.md` | لقاء أسبوعي واحد (عربي + سويدي) |
| `src/data/site.ts` | البريد، الهاتف، واتساب، يوتيوب، تيك توك، رقم التسجيل |
| `src/i18n/ar.ts` / `sv.ts` | قيم احتياطية فقط إذا نقص مفتاح من MD |
| `src/styles/global.css` | الهوية البصرية، الألوان، المسافات، التجاوب |
| `src/assets/images/` | الصور والشعار |
| `src/pages/` | الصفحات ونقطة `robots.txt` |
| `public/` | الأيقونات، صور OG، `_headers`، `_redirects` |

### بنية ملفات الصفحات

كل ملف صفحة يحتوي كتلتين:

```yaml
---
ar:
  hero:
    titleLine1: معًا من أجل
    ...
sv:
  hero:
    titleLine1: Tillsammans för en
    ...
---
```

### بنية ملف اللقاء

```yaml
---
date: '2026-11-08'
tag:
  ar: الأحد الماضي
  sv: Förra söndagen
topic:
  ar: ...
  sv: ...
summary:
  ar: ...
  sv: ...
takeaway:
  ar: ...
  sv: ...
adults:
  ar: ...
  sv: ...
children:
  ar: ...
  sv: ...
lecture:
  ar: ...
  sv: ...
images:
  - src: ../../assets/images/about-main.jpg
    alt:
      ar: ...
      sv: ...
video:
  url: https://www.youtube.com/@dengladafamiljen7954
  label:
    ar: ...
    sv: ...
  note:
    ar: ...
    sv: ...
---
```

- اسم الملف هو التاريخ `YYYY-MM-DD`.
- الصور نسبية إلى ملف اللقاء: `../../assets/images/...`.
- الصور المرفوعة من اللوحة تُحفظ في `src/assets/images/uploads/`.
- الحد الأقصى 4 صور لكل لقاء.

### تحديث اللقاءات الأسبوعية

**من لوحة التحكم:** تبويب **اللقاءات** → **+ إضافة لقاء** → املأ التاريخ والوسم والموضوع والملخص → ارفع صورة واحدة على الأقل → **حفظ ونشر**.

**يدويًا:** أضف ملفًا جديدًا في `src/content/meetings/YYYY-MM-DD.md` بنفس البنية أعلاه.

كل أحد من **16:00 إلى 21:00** في مقر الجمعية:

**ABF-huset — Pilgatan 2, Västerås**

اللقاءات بالتعاون مع **ABF**، وتشمل ضيافة (fika)، موقف سيارات، والأطفال مرحب بهم.

> إذا لم يكن هناك لقاء قادم بتاريخ اليوم أو أكبر، لا يظهر شريط «اللقاء القادم» في الصفحة الرئيسية. أضف اللقاء القادم من اللوحة ليظهر مجددًا.

### الصور

- تبويب **الصور** يستبدل صور الواجهة ومن نحن والمعرض والشعار.
- الصور تُضغط تلقائيًا قبل الرفع (حد أقصى 4MB).
- الشعار يفضل أن يكون PNG بخلفية شفافة.
- صور اللقاءات تُرفع من محرر اللقاء.
- الصور الحالية تعبيرية من [Pexels](https://www.pexels.com/) (مرخّصة للاستخدام المجاني)؛ يُفضّل استبدالها بصور حقيقية من أنشطة الجمعية.

---

## النشر على Cloudflare Pages

### الطريقة 1: عبر لوحة Cloudflare (موصى بها)

1. ارفع المشروع إلى GitHub.
2. من Cloudflare Dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. اختر المستودع.
4. الإعدادات:
   - **Framework preset:** Astro (أو None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION = 22.23.4`
   - **Environment variable (اختياري):** `SITE_URL = https://your-domain.com` للنطاق المخصص
5. أضف متغيرات لوحة التحكم من الجدول أعلاه.
6. اضغط **Save and Deploy**.

Cloudflare يكتشف مجلد `functions/` تلقائيًا وينشر الـ API مع الموقع.

### الطريقة 2: عبر Wrangler CLI

```bash
npm run build
npx wrangler pages deploy dist --project-name den-glada-familjen
```

> هذه الطريقة ترفع الموقع والـ Functions، لكنها لا تُنشئ نشرًا تلقائيًا بعد commits لوحة التحكم. استخدم Git integration، أو أضف GitHub Actions تنفّذ الأمر أعلاه بعد كل push.

### النطاق المخصص

بعد نجاح أول نشر:

1. من مشروع Pages: **Custom domains → Set up a custom domain**.
2. أضف النطاق واتبع تعليمات DNS.
3. أضف `SITE_URL` في متغيرات البيئة ثم أعد النشر.

> ملف `public/_headers` يضيف ترويسات أمان وCSP، وملف `public/_redirects` يعالج روابط `/ar`.

---

## ملاحظات مهمة

- **الصور:** الصور الفوتوغرافية الحالية تعبيرية من Pexels. استبدلها بصور حقيقية من اللقاءات عبر تبويب «الصور» أو محرر اللقاء.
- **اللقاءات الأسبوعية:** المحتوى في `src/content/meetings/`. أضف لقاءً جديدًا من اللوحة أسبوعيًا، وحدّث الوسم («غدًا» / «الأحد الماضي») بعد انتهاء اللقاء.
- **نموذج التواصل:** لا يوجد خادم للبريد. النموذج يفتح تطبيق البريد الإلكتروني لدى الزائر عبر `mailto:`. إذا رغبتم بنموذج حقيقي، اربطوه بخدمة بريد.
- **الخصوصية:** الموقع العام لا يستخدم كوكيز أو أدوات تتبّع. لوحة الإدارة تستخدم كوكي جلسة للمدير فقط.
- **البيانات:** رقم التسجيل `802527-6026` والبريد والهاتف مأخوذة من الصفحة الحالية للجمعية ومن السجلات العامة. راجعوا صحتها قبل النشر النهائي. هذه القيم في `src/data/site.ts` وليست قابلة للتعديل من اللوحة حاليًا.
- **الخريطة:** خريطة ثابتة خفيفة من OpenStreetMap محفوظة محليًا في `src/assets/images/map-pilgatan.png` مع علامة الموقع، وتفتح خرائط Google عند الضغط. لا iframe ولا طلبات خارجية وقت التحميل. الإسناد: © OpenStreetMap contributors.
- **CSP والخطوط:** سياسة `_headers` تسمح بـ `font-src 'self' data:` لأن Astro/Vite يضمّن بعض ملفات الخطوط الصغيرة كـ data URI. الخطوط ما زالت محلية بالكامل.
- **تفاعل الواجهة:** تم تعطيل تحديد النص في عناصر الواجهة للحفاظ على مظهر تطبيقي، مع إبقاء حقول الإدخال وبيانات التواصل قابلة للنسخ.
- **الترجمة:** النصوص السويدية والعربية مكتوبة يدويًا؛ يُنصح بمراجعة لغوية سريعة من متحدث أصلي قبل الإطلاق.
- **تعدد المحررين:** لا يوجد قفل تحرير. إذا عدّل شخصان الملف نفسه، سيرفض GitHub الحفظ الثاني ويطلب إعادة التحميل.
- **حذف اللقاء:** يحذف ملف MD فقط، ولا يحذف صوره المرفوعة من `src/assets/images/uploads/` (يمكن حذفها يدويًا لاحقًا).

---

## بنية المشروع

```text
/
├── functions/                  # Cloudflare Pages Functions (API لوحة التحكم)
│   ├── _lib/                   # المصادقة، GitHub، التحقق، الأدوات
│   └── api/
│       ├── auth/               # login / logout / session
│       └── admin/              # content / files / images / upload
├── public/                     # ملفات ثابتة (أيقونات، OG، headers, redirects)
├── scripts/
│   └── hash-password.mjs       # توليد ADMIN_PASSWORD_HASH
├── src/
│   ├── assets/images/          # الشعار والصور (بما فيها uploads/)
│   ├── components/             # أقسام الصفحة والمكونات
│   ├── content/
│   │   ├── pages/              # home.md / meetings.md / site.md
│   │   └── meetings/           # YYYY-MM-DD.md
│   ├── content.config.ts       # تعريف مجموعات المحتوى
│   ├── data/meetings.ts        # تحميل اللقاءات من content
│   ├── data/site.ts            # بيانات التواصل والروابط
│   ├── i18n/                   # قواميس احتياطية
│   ├── layouts/                # القالب الأساسي + قالب اللوحة
│   ├── pages/                  # / و /sv/ و /admin/
│   ├── scripts/admin/          # كود لوحة التحكم
│   └── styles/                 # الخطوط والتصميم
├── astro.config.mjs
├── package.json
└── README.md
```

---

## الترخيص

الكود مخصص لجمعية الأسرة السعيدة. الصور الفوتوغرافية من Pexels وفق ترخيص Pexels. الشعار وحقوقه ملك الجمعية.
