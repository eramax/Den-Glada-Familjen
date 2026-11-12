import { api, imageUrl } from './api';
import { extensionFromPath, prepareImage } from './image-utils';
import { labelFor, SECTION_LABELS } from './labels';
import { toast } from './ui';

type JsonObject = Record<string, unknown>;
type Lang = 'ar' | 'sv';

const LONG_KEYS = new Set([
  'lead',
  'description',
  'text',
  'body',
  'summary',
  'quote',
  'note',
  'a',
  'takeaway',
  'lecture',
  'adults',
  'children',
  'panelText',
  'helpText',
  'ctaText',
  'privacy',
  'made',
  'about',
  'message',
  'metaDescription',
  'scheduleNote',
  'timelineLead',
  'formatLead',
  'locationNote',
  'amenities',
  'shareText',
]);

const NO_ADD_PATHS = new Set(['gallery.items']);

// Fields that are identical in both languages (identifiers, icons, links).
const SHARED_KEYS = new Set(['id', 'href', 'icon', 'tone', 'key']);

const CONTENT_IMAGE_PATHS: Record<
  string,
  { path: string; label: string }
> = {
  'hero.imageAlt': {
    path: 'src/assets/images/hero.jpg',
    label: 'صورة الواجهة الرئيسية',
  },
  'about.imageAltMain': {
    path: 'src/assets/images/about-main.jpg',
    label: 'من نحن — الصورة الرئيسية',
  },
  'about.imageAltSmall': {
    path: 'src/assets/images/about-small.jpg',
    label: 'من نحن — الصورة الصغيرة',
  },
  'meetingsPage.mapAlt': {
    path: 'src/assets/images/map-pilgatan.png',
    label: 'خريطة الموقع',
  },
};

const GALLERY_IMAGES: Record<string, { path: string; label: string }> = {
  community: {
    path: 'src/assets/images/gallery-community.jpg',
    label: 'المعرض — لقاءاتنا',
  },
  kids: {
    path: 'src/assets/images/gallery-kids.jpg',
    label: 'المعرض — إبداع الأطفال',
  },
  trip: {
    path: 'src/assets/images/gallery-trip.jpg',
    label: 'المعرض — الرحلات',
  },
  dinner: {
    path: 'src/assets/images/gallery-dinner.jpg',
    label: 'المعرض — موائد العائلة',
  },
};

function resolveContentImage(
  path: string,
  arParent: JsonObject,
): { path: string; label: string } | null {
  const direct = CONTENT_IMAGE_PATHS[path];
  if (direct) return direct;

  if (/^gallery\.items\[\d+\]\.alt$/.test(path)) {
    const key = arParent.key;
    if (typeof key === 'string' && GALLERY_IMAGES[key]) {
      return GALLERY_IMAGES[key];
    }
  }

  return null;
}

// Most useful sections first, technical/SEO sections last.
const SECTION_ORDER = [
  'meetingsPage',
  'hero',
  'about',
  'activities',
  'gallery',
  'join',
  'faq',
  'contact',
  'stats',
  'values',
  'motto',
  'meta',
  'brand',
  'nav',
  'footer',
  'a11y',
];

const SECTION_RANK = new Map(
  SECTION_ORDER.map((key, index) => [key, index] as const),
);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyLike(value: unknown): unknown {
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return [];
  if (isObject(value)) {
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = emptyLike(item);
    }
    return output;
  }
  return '';
}

function templateForArray(array: unknown[]): unknown {
  if (array.length === 0) return '';
  if (array.every(isObject)) {
    const template: JsonObject = {};
    for (const item of array) {
      for (const [key, value] of Object.entries(item)) {
        if (!(key in template)) template[key] = emptyLike(value);
      }
    }
    return template;
  }
  return emptyLike(array[0]);
}

function isLongField(key: string, value: string): boolean {
  return LONG_KEYS.has(key) || value.length > 90 || value.includes('\n');
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function makeControl(
  value: string,
  path: string,
  lang: Lang,
  multiline: boolean,
  onInput: (value: string) => void,
): HTMLInputElement | HTMLTextAreaElement {
  const key = path.split('.').pop() ?? '';
  const isUrl = key === 'href' || key === 'url';
  const element = multiline
    ? document.createElement('textarea')
    : document.createElement('input');

  if (element instanceof HTMLTextAreaElement) {
    element.rows = key === 'body' ? 5 : 3;
  } else {
    element.type = isUrl ? 'url' : 'text';
  }

  element.className = multiline ? 'admin-textarea' : 'admin-input';
  element.value = value;
  element.dir = isUrl ? 'ltr' : lang === 'ar' ? 'rtl' : 'ltr';
  element.lang = lang;
  element.dataset.path = path;
  element.dataset.lang = lang;
  if (isUrl) {
    element.spellcheck = false;
    element.autocomplete = 'off';
  }

  element.addEventListener('input', () => onInput(element.value));
  return element;
}

function renderContentImage(
  imagePath: string,
  label: string,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'content-image';

  const preview = document.createElement('div');
  preview.className = 'content-image__preview';

  const image = document.createElement('img');
  image.alt = label;
  image.src = imageUrl(imagePath);
  image.addEventListener('error', () => {
    image.hidden = true;
  });
  preview.append(image);

  const body = document.createElement('div');
  body.className = 'content-image__body';

  const title = document.createElement('span');
  title.className = 'content-image__label';
  title.textContent = label;

  const hint = document.createElement('span');
  hint.className = 'content-image__hint';
  hint.textContent = 'تُحفظ الصورة فور رفعها، والوصف يُحفظ مع الصفحة.';

  const replaceLabel = document.createElement('label');
  replaceLabel.className = 'btn btn--small btn--ghost';

  const replaceText = document.createElement('span');
  replaceText.textContent = 'استبدال الصورة';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.hidden = true;

  let sha = '';

  api
    .getMeta(imagePath)
    .then((meta) => {
      sha = meta.sha;
      image.src = imageUrl(imagePath, sha);
      image.hidden = false;
    })
    .catch(() => {
      // The image may be new; upload will create it.
    });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    replaceText.textContent = 'جارٍ الرفع...';
    input.disabled = true;

    try {
      if (!sha) {
        try {
          const meta = await api.getMeta(imagePath);
          sha = meta.sha;
        } catch {
          // New file.
        }
      }

      const prepared = await prepareImage(
        file,
        extensionFromPath(imagePath),
        imagePath.includes('logo') ? 900 : 2000,
      );
      const result = await api.upload(imagePath, sha, prepared.base64);
      sha = result.sha;
      image.src = imageUrl(imagePath, result.sha);
      image.hidden = false;
      toast('تم رفع الصورة. ستظهر بعد إعادة البناء.', {
        link: result.commitUrl,
      });
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'تعذّر رفع الصورة.',
        { type: 'error' },
      );
    } finally {
      replaceText.textContent = 'استبدال الصورة';
      input.disabled = false;
      input.value = '';
    }
  });

  replaceLabel.append(replaceText, input);
  body.append(title, hint, replaceLabel);
  card.append(preview, body);
  return card;
}

function renderSharedField(
  arParent: JsonObject,
  svParent: JsonObject,
  key: string,
  path: string,
  onChange: () => void,
): HTMLElement {
  const label = document.createElement('label');
  label.className = 'admin-field';

  const caption = document.createElement('span');
  caption.className = 'admin-field__label';
  caption.textContent = labelFor(path);

  const control = makeControl(
    stringValue(arParent[key]),
    path,
    'ar',
    false,
    (value) => {
      arParent[key] = value;
      svParent[key] = value;
      onChange();
    },
  );
  control.dir = 'ltr';
  control.setAttribute('aria-label', labelFor(path));

  label.append(caption, control);
  return label;
}

function renderPair(
  arParent: JsonObject,
  svParent: JsonObject,
  key: string,
  path: string,
  onChange: () => void,
): HTMLElement {
  const arValue = stringValue(arParent[key]);
  const svValue = stringValue(svParent[key]);
  const multiline = isLongField(key, arValue) || isLongField(key, svValue);

  const field = document.createElement('div');
  field.className = 'localized-field';

  const caption = document.createElement('span');
  caption.className = 'localized-field__label';
  caption.textContent = labelFor(path);

  const grid = document.createElement('div');
  grid.className = 'localized-grid';

  for (const lang of ['ar', 'sv'] as const) {
    const parent = lang === 'ar' ? arParent : svParent;
    const inputWrap = document.createElement('label');
    inputWrap.className = 'localized-input';

    const badge = document.createElement('span');
    badge.className = 'localized-input__badge';
    badge.textContent = lang === 'ar' ? 'AR' : 'SV';

    const control = makeControl(
      stringValue(parent[key]),
      path,
      lang,
      multiline,
      (value) => {
        parent[key] = value;
        onChange();
      },
    );
    control.setAttribute(
      'aria-label',
      `${labelFor(path)} — ${lang === 'ar' ? 'العربية' : 'Svenska'}`,
    );

    inputWrap.append(badge, control);
    grid.append(inputWrap);
  }

  field.append(caption, grid);

  const contentImage = resolveContentImage(path, arParent);
  if (contentImage) {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-with-alt';
    wrapper.append(
      renderContentImage(contentImage.path, contentImage.label),
      field,
    );
    return wrapper;
  }

  return field;
}

function renderObject(
  arObject: JsonObject,
  svObject: JsonObject,
  path: string,
  onChange: () => void,
): HTMLElement {
  const fields = document.createElement('div');
  fields.className = 'admin-fields';

  for (const [key, arValue] of Object.entries(arObject)) {
    if (path.startsWith('gallery.items') && key === 'key') continue;

    const childPath = `${path}.${key}`;
    let svValue = svObject[key];
    if (svValue === undefined) {
      svValue = emptyLike(arValue);
      svObject[key] = svValue;
    }

    if (isObject(arValue) && isObject(svValue)) {
      const group = document.createElement('fieldset');
      group.className = 'admin-group';
      const legend = document.createElement('legend');
      legend.textContent = labelFor(childPath);
      group.append(
        legend,
        renderObject(arValue, svValue, childPath, onChange),
      );
      fields.append(group);
      continue;
    }

    if (Array.isArray(arValue) && Array.isArray(svValue)) {
      fields.append(
        renderArray(key, arValue, svValue, childPath, onChange),
      );
      continue;
    }

    if (SHARED_KEYS.has(key)) {
      fields.append(
        renderSharedField(arObject, svObject, key, childPath, onChange),
      );
      continue;
    }

    fields.append(renderPair(arObject, svObject, key, childPath, onChange));
  }

  return fields;
}

function renderArray(
  key: string,
  arArray: unknown[],
  svArray: unknown[],
  path: string,
  onChange: () => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'admin-array';
  wrapper.dataset.path = path;

  const head = document.createElement('div');
  head.className = 'admin-array__head';

  const title = document.createElement('span');
  title.className = 'admin-array__label';
  title.textContent = labelFor(path);

  const count = document.createElement('span');
  count.className = 'admin-array__count';
  count.textContent = String(Math.max(arArray.length, svArray.length));

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'btn btn--small btn--ghost';
  add.textContent = '+ إضافة';
  add.hidden = NO_ADD_PATHS.has(path);

  const list = document.createElement('div');
  list.className = 'admin-array__list';

  const hint = document.createElement('p');
  hint.className = 'admin-array__hint';
  hint.textContent =
    'لاستبدال صور المعرض استخدم تبويب «عام → الصور والشعار». مفاتيح الصور مخفية للحفاظ على الربط.';
  hint.hidden = !NO_ADD_PATHS.has(path);

  const rerender = () => {
    const length = Math.max(arArray.length, svArray.length);
    count.textContent = String(length);
    list.replaceChildren();

    if (length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-array__empty';
      empty.textContent = 'لا توجد عناصر بعد.';
      list.append(empty);
      return;
    }

    for (let index = 0; index < length; index += 1) {
      const arItem = arArray[index];
      const svItem = svArray[index];
      const itemPath = `${path}[${index}]`;

      if (isObject(arItem) || isObject(svItem)) {
        const arObject = isObject(arItem) ? arItem : {};
        const svObject = isObject(svItem) ? svItem : {};
        if (!isObject(arArray[index])) arArray[index] = arObject;
        if (!isObject(svArray[index])) svArray[index] = svObject;

        const card = document.createElement('div');
        card.className = 'admin-array__card';
        card.dataset.path = itemPath;

        const cardHead = document.createElement('div');
        cardHead.className = 'admin-array__card-head';

        const cardTitle = document.createElement('span');
        cardTitle.className = 'admin-array__card-title';
        cardTitle.textContent = `عنصر ${index + 1}`;

        const actions = document.createElement('span');
        actions.className = 'admin-array__actions';

        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'icon-btn';
        up.setAttribute('aria-label', 'تحريك لأعلى');
        up.textContent = '↑';
        up.disabled = index === 0;
        up.addEventListener('click', () => {
          [arArray[index - 1], arArray[index]] = [
            arArray[index],
            arArray[index - 1],
          ];
          [svArray[index - 1], svArray[index]] = [
            svArray[index],
            svArray[index - 1],
          ];
          onChange();
          rerender();
        });

        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'icon-btn';
        down.setAttribute('aria-label', 'تحريك لأسفل');
        down.textContent = '↓';
        down.disabled = index === length - 1;
        down.addEventListener('click', () => {
          [arArray[index + 1], arArray[index]] = [
            arArray[index],
            arArray[index + 1],
          ];
          [svArray[index + 1], svArray[index]] = [
            svArray[index],
            svArray[index + 1],
          ];
          onChange();
          rerender();
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'icon-btn icon-btn--danger';
        remove.setAttribute('aria-label', 'حذف العنصر');
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          arArray.splice(index, 1);
          svArray.splice(index, 1);
          onChange();
          rerender();
        });

        actions.append(up, down, remove);
        cardHead.append(cardTitle, actions);
        card.append(
          cardHead,
          renderObject(arObject, svObject, itemPath, onChange),
        );
        list.append(card);
        continue;
      }

      const arValue = stringValue(arItem);
      const svValue = stringValue(svItem);
      const multiline =
        isLongField(key, arValue) || isLongField(key, svValue);

      const row = document.createElement('div');
      row.className = 'admin-array__row admin-array__row--dual';

      const grid = document.createElement('div');
      grid.className = 'localized-grid';

      for (const lang of ['ar', 'sv'] as const) {
        const inputWrap = document.createElement('label');
        inputWrap.className = 'localized-input';

        const badge = document.createElement('span');
        badge.className = 'localized-input__badge';
        badge.textContent = lang === 'ar' ? 'AR' : 'SV';

        const control = makeControl(
          lang === 'ar' ? arValue : svValue,
          itemPath,
          lang,
          multiline,
          (value) => {
            if (lang === 'ar') arArray[index] = value;
            else svArray[index] = value;
            onChange();
          },
        );
        control.setAttribute(
          'aria-label',
          `${labelFor(path)} ${index + 1} — ${
            lang === 'ar' ? 'العربية' : 'Svenska'
          }`,
        );

        inputWrap.append(badge, control);
        grid.append(inputWrap);
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn icon-btn--danger';
      remove.setAttribute('aria-label', 'حذف العنصر');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        arArray.splice(index, 1);
        svArray.splice(index, 1);
        onChange();
        rerender();
      });

      row.append(grid, remove);
      list.append(row);
    }
  };

  add.addEventListener('click', () => {
    const first = arArray[0] ?? svArray[0];
    if (isObject(first)) {
      const template = templateForArray(arArray.length ? arArray : svArray);
      arArray.push(template);
      svArray.push(emptyLike(template));
    } else {
      arArray.push('');
      svArray.push('');
    }
    onChange();
    rerender();
  });

  head.append(title, count, add);
  wrapper.append(head, hint, list);
  rerender();
  return wrapper;
}

function renderSection(
  key: string,
  arValue: unknown,
  svValue: unknown,
  onChange: () => void,
): HTMLElement {
  const details = document.createElement('details');
  details.className = 'admin-section';
  details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'admin-section__summary';

  const title = document.createElement('span');
  title.className = 'admin-section__title';
  title.textContent = SECTION_LABELS[key] ?? labelFor(key);

  const meta = document.createElement('span');
  meta.className = 'admin-section__meta';
  if (Array.isArray(arValue)) meta.textContent = `${arValue.length} عنصر`;
  else if (isObject(arValue)) meta.textContent = `${Object.keys(arValue).length} حقل`;

  summary.append(title, meta);

  const body = document.createElement('div');
  body.className = 'admin-section__body';

  if (isObject(arValue) && isObject(svValue)) {
    body.append(renderObject(arValue, svValue, key, onChange));
  } else if (Array.isArray(arValue) && Array.isArray(svValue)) {
    body.append(
      renderArray(key, arValue, svValue, key, onChange),
    );
  } else {
    body.append(
      renderPair(
        { [key]: arValue },
        { [key]: svValue },
        key,
        key,
        onChange,
      ),
    );
  }

  details.append(summary, body);
  return details;
}

export function renderPageForm(
  container: HTMLElement,
  data: { ar: JsonObject; sv: JsonObject },
  onChange: () => void,
): void {
  container.replaceChildren();

  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';

  const note = document.createElement('p');
  note.className = 'dual-note';
  note.textContent = 'الحقول العربية على اليمين، والسويدية على اليسار.';

  const actions = document.createElement('div');
  actions.className = 'editor-toolbar__actions';

  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'btn btn--small btn--ghost';
  expand.textContent = 'فتح الكل';

  const collapse = document.createElement('button');
  collapse.type = 'button';
  collapse.className = 'btn btn--small btn--ghost';
  collapse.textContent = 'طي الكل';

  actions.append(expand, collapse);
  toolbar.append(note, actions);

  const panel = document.createElement('div');
  panel.className = 'editor-sections';

  const keys = Object.keys(data.ar).sort(
    (first, second) =>
      (SECTION_RANK.get(first) ?? 999) -
      (SECTION_RANK.get(second) ?? 999),
  );

  for (const key of keys) {
    const arValue = data.ar[key];
    let svValue = data.sv[key];
    if (svValue === undefined) {
      svValue = emptyLike(arValue);
      data.sv[key] = svValue;
    }
    panel.append(renderSection(key, arValue, svValue, onChange));
  }

  if (keys.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = 'لا توجد بيانات في هذا الملف.';
    panel.append(empty);
  }

  expand.addEventListener('click', () => {
    panel.querySelectorAll('details').forEach((details) => {
      details.open = true;
    });
  });

  collapse.addEventListener('click', () => {
    panel.querySelectorAll('details').forEach((details) => {
      details.open = false;
    });
  });

  container.append(toolbar, panel);
}
