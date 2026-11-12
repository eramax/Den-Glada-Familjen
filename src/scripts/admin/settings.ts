import { ApiError, api } from './api';
import { loadingBlock, setBusy, toast as showToast } from './ui';
import type { ToastOptions } from './ui';

const PATH = 'src/content/settings.json';

type Settings = Record<string, string>;

interface FieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  ltr?: boolean;
}

const FIELDS: FieldDefinition[] = [
  { key: 'email', label: 'البريد الإلكتروني', type: 'email', ltr: true },
  { key: 'phone', label: 'رقم الهاتف الدولي', type: 'tel', ltr: true },
  { key: 'phoneDisplay', label: 'رقم الهاتف للعرض', type: 'tel', ltr: true },
  { key: 'whatsappGroup', label: 'رابط مجموعة واتساب', type: 'url', ltr: true },
  { key: 'whatsappDirect', label: 'رابط واتساب مباشر', type: 'url', ltr: true },
  { key: 'youtube', label: 'رابط قناة يوتيوب', type: 'url', ltr: true },
  { key: 'tiktok', label: 'رابط حساب تيك توك', type: 'url', ltr: true },
  { key: 'orgNumber', label: 'رقم تسجيل الجمعية', ltr: true },
  { key: 'founded', label: 'سنة التأسيس', ltr: true },
  { key: 'city', label: 'المدينة' },
  { key: 'mapsUrl', label: 'رابط خرائط Google', type: 'url', ltr: true },
  {
    key: 'osmCopyright',
    label: 'رابط حقوق OpenStreetMap',
    type: 'url',
    ltr: true,
  },
];

export interface SettingsViewOptions {
  container: HTMLElement;
  setDirty: (dirty: boolean) => void;
  onAuthError: () => void;
}

export function createSettingsView(options: SettingsViewOptions): {
  load: () => Promise<void>;
} {
  const { container, setDirty, onAuthError } = options;

  let data: Settings = {};
  let sha = '';
  let statusElement: HTMLElement | null = null;

  const toast = (message: string, toastOptions: ToastOptions = {}) => {
    showToast(message, toastOptions);
  };

  const handleError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onAuthError();
      return;
    }
    toast(
      error instanceof Error ? error.message : 'حدث خطأ غير متوقع.',
      { type: 'error' },
    );
  };

  const markDirty = () => {
    setDirty(true);
    if (statusElement) {
      statusElement.textContent = 'تغييرات غير محفوظة';
      statusElement.classList.add('is-dirty');
    }
  };

  const markClean = () => {
    setDirty(false);
    if (statusElement) {
      statusElement.textContent = 'كل التغييرات محفوظة';
      statusElement.classList.remove('is-dirty');
    }
  };

  const render = () => {
    container.replaceChildren();

    const head = document.createElement('div');
    head.className = 'view-head';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'بيانات التواصل';
    const description = document.createElement('p');
    description.textContent =
      'البريد، الهاتف، واتساب، يوتيوب، تيك توك، رقم التسجيل، والعنوان. تُستخدم هذه القيم في الهيدر والفوتر وصفحة اللقاءات.';
    copy.append(title, description);
    head.append(copy);
    container.append(head);

    const form = document.createElement('div');
    form.className = 'admin-fields settings-fields';

    for (const field of FIELDS) {
      const label = document.createElement('label');
      label.className = 'admin-field';

      const caption = document.createElement('span');
      caption.className = 'admin-field__label';
      caption.textContent = field.label;

      const input = document.createElement('input');
      input.className = 'admin-input';
      input.type = field.type ?? 'text';
      input.value = data[field.key] ?? '';
      if (field.ltr) input.dir = 'ltr';
      input.addEventListener('input', () => {
        data[field.key] = input.value;
        markDirty();
      });

      label.append(caption, input);
      form.append(label);
    }

    container.append(form);

    const bar = document.createElement('div');
    bar.className = 'admin-savebar';

    statusElement = document.createElement('span');
    statusElement.className = 'admin-savebar__status';
    statusElement.textContent = 'كل التغييرات محفوظة';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn btn--primary';
    save.textContent = 'حفظ ونشر';

    save.addEventListener('click', async () => {
      setBusy(save, true);
      try {
        const text = `${JSON.stringify(data, null, 2)}\n`;
        const saved = await api.saveContent(PATH, sha, text);
        sha = saved.sha;
        markClean();
        toast('تم حفظ بيانات التواصل. ستظهر بعد إعادة البناء.', {
          link: saved.commitUrl,
        });
      } catch (error) {
        handleError(error);
      } finally {
        setBusy(save, false);
      }
    });

    bar.append(statusElement, save);
    container.append(bar);
  };

  const load = async () => {
    container.replaceChildren(loadingBlock('جارٍ تحميل بيانات التواصل...'));
    try {
      const response = await api.getContent(PATH);
      const parsed = JSON.parse(response.text) as Settings;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('ملف بيانات التواصل غير صالح.');
      }
      data = parsed;
      sha = response.sha;
      markClean();
      render();
    } catch (error) {
      handleError(error);
    }
  };

  return { load };
}
