import { labelFor, SECTION_LABELS } from './labels';

type JsonObject = Record<string, unknown>;

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

function makeInput(
  value: string,
  path: string,
  lang: 'ar' | 'sv',
  multiline: boolean,
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
  if (isUrl) {
    element.spellcheck = false;
    element.autocomplete = 'off';
  }
  return element;
}

function renderScalar(
  parent: JsonObject,
  key: string,
  value: unknown,
  path: string,
  onChange: () => void,
  lang: 'ar' | 'sv',
): HTMLElement {
  const label = document.createElement('label');
  label.className = 'admin-field';
  label.dataset.path = path;

  const caption = document.createElement('span');
  caption.className = 'admin-field__label';
  caption.textContent = labelFor(path);

  if (typeof value === 'boolean') {
    const row = document.createElement('span');
    row.className = 'admin-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => {
      parent[key] = input.checked;
      onChange();
    });
    row.append(input);
    label.append(caption, row);
    return label;
  }

  if (typeof value === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'admin-input';
    input.value = String(value);
    input.addEventListener('input', () => {
      parent[key] = input.value === '' ? 0 : Number(input.value);
      onChange();
    });
    label.append(caption, input);
    return label;
  }

  const stringValue = typeof value === 'string' ? value : '';
  const longField = isLongField(key, stringValue);
  const input = makeInput(stringValue, path, lang, longField);
  if (longField) label.classList.add('admin-field--wide');

  input.addEventListener('input', () => {
    parent[key] = input.value;
    onChange();
  });

  label.append(caption, input);
  return label;
}

function renderObjectBody(
  object: JsonObject,
  path: string,
  onChange: () => void,
  lang: 'ar' | 'sv',
): HTMLElement {
  const fields = document.createElement('div');
  fields.className = 'admin-fields';

  for (const [key, value] of Object.entries(object)) {
    // Gallery keys are internal identifiers mapped to imported images.
    if (path.startsWith('gallery.items') && key === 'key') continue;

    const childPath = `${path}.${key}`;

    if (isObject(value)) {
      const group = document.createElement('fieldset');
      group.className = 'admin-group';
      const legend = document.createElement('legend');
      legend.textContent = labelFor(childPath);
      group.append(legend, renderObjectBody(value, childPath, onChange, lang));
      fields.append(group);
      continue;
    }

    if (Array.isArray(value)) {
      fields.append(renderArray(value, childPath, onChange, lang));
      continue;
    }

    fields.append(renderScalar(object, key, value, childPath, onChange, lang));
  }

  return fields;
}

function renderArray(
  array: unknown[],
  path: string,
  onChange: () => void,
  lang: 'ar' | 'sv',
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
  count.textContent = String(array.length);

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
    'لاستبدال صور المعرض استخدم تبويب «الصور» في الأعلى. مفاتيح الصور مخفية للحفاظ على الربط.';
  hint.hidden = !NO_ADD_PATHS.has(path);

  const rerender = () => {
    count.textContent = String(array.length);
    list.replaceChildren();

    if (array.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-array__empty';
      empty.textContent = 'لا توجد عناصر بعد.';
      list.append(empty);
      return;
    }

    array.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;

      if (isObject(item)) {
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
          [array[index - 1], array[index]] = [array[index], array[index - 1]];
          onChange();
          rerender();
        });

        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'icon-btn';
        down.setAttribute('aria-label', 'تحريك لأسفل');
        down.textContent = '↓';
        down.disabled = index === array.length - 1;
        down.addEventListener('click', () => {
          [array[index + 1], array[index]] = [array[index], array[index + 1]];
          onChange();
          rerender();
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'icon-btn icon-btn--danger';
        remove.setAttribute('aria-label', 'حذف العنصر');
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          array.splice(index, 1);
          onChange();
          rerender();
        });

        actions.append(up, down, remove);
        cardHead.append(cardTitle, actions);
        card.append(
          cardHead,
          renderObjectBody(item, itemPath, onChange, lang),
        );
        list.append(card);
        return;
      }

      const row = document.createElement('div');
      row.className = 'admin-array__row';

      if (typeof item === 'string') {
        const input = makeInput(
          item,
          `${itemPath}`,
          lang,
          item.length > 90 || item.includes('\n'),
        );
        input.setAttribute(
          'aria-label',
          `${labelFor(path)} ${index + 1}`,
        );
        input.addEventListener('input', () => {
          array[index] = input.value;
          onChange();
        });
        row.append(input);
      } else {
        const scalar = document.createElement('span');
        scalar.className = 'admin-array__scalar';
        scalar.textContent = String(item ?? '');
        row.append(scalar);
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn icon-btn--danger';
      remove.setAttribute('aria-label', 'حذف العنصر');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        array.splice(index, 1);
        onChange();
        rerender();
      });
      row.append(remove);
      list.append(row);
    });
  };

  add.addEventListener('click', () => {
    array.push(templateForArray(array));
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
  value: unknown,
  onChange: () => void,
  lang: 'ar' | 'sv',
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
  if (Array.isArray(value)) meta.textContent = `${value.length} عنصر`;
  else if (isObject(value)) meta.textContent = `${Object.keys(value).length} حقل`;

  summary.append(title, meta);

  const body = document.createElement('div');
  body.className = 'admin-section__body';

  if (isObject(value)) {
    body.append(renderObjectBody(value, key, onChange, lang));
  } else if (Array.isArray(value)) {
    body.append(renderArray(value, key, onChange, lang));
  } else {
    body.append(renderScalar({ [key]: value }, key, value, key, onChange, lang));
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

  const tabs = document.createElement('div');
  tabs.className = 'editor-lang-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'لغة المحتوى');

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
  toolbar.append(tabs, actions);

  const panel = document.createElement('div');
  panel.className = 'editor-sections';
  panel.setAttribute('role', 'tabpanel');

  const languages: Array<'ar' | 'sv'> = ['ar', 'sv'];
  const buttons: HTMLButtonElement[] = [];
  let active: 'ar' | 'sv' = 'ar';

  const renderActive = () => {
    buttons.forEach((button, index) => {
      button.classList.toggle('is-active', languages[index] === active);
      button.setAttribute('aria-selected', String(languages[index] === active));
    });

    panel.replaceChildren();
    const languageData = data[active] ?? {};

    const sections = Object.entries(languageData).sort(
      ([first], [second]) =>
        (SECTION_RANK.get(first) ?? 999) -
        (SECTION_RANK.get(second) ?? 999),
    );

    for (const [key, value] of sections) {
      panel.append(renderSection(key, value, onChange, active));
    }

    if (Object.keys(languageData).length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = 'لا توجد بيانات في هذا الملف.';
      panel.append(empty);
    }
  };

  for (const language of languages) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-lang-tab';
    button.textContent = language === 'ar' ? 'العربية' : 'Svenska';
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => {
      active = language;
      renderActive();
    });
    buttons.push(button);
    tabs.append(button);
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
  renderActive();
}
