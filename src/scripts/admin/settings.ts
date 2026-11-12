import { ApiError, api } from './api';
import { loadingBlock, setBusy, toast as showToast } from './ui';
import type { ToastOptions } from './ui';

const PATH = 'src/content/settings.json';

type Settings = Record<string, string>;
type GroupId = 'contact' | 'social' | 'location' | 'org';

interface FieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  ltr?: boolean;
  group: GroupId;
}

const GROUPS: Array<{
  id: GroupId;
  label: string;
  description: string;
}> = [
  {
    id: 'contact',
    label: 'التواصل المباشر',
    description: 'البريد الإلكتروني والهاتف المستخدمان في الموقع والفوتر.',
  },
  {
    id: 'social',
    label: 'روابط التواصل الاجتماعي',
    description:
      'يوتيوب، تيك توك، واتساب. هذه الروابط تُستخدم في الفوتر وأزرار الموقع.',
  },
  {
    id: 'location',
    label: 'الموقع والخريطة',
    description: 'رابط خرائط Google وحقوق OpenStreetMap.',
  },
  {
    id: 'org',
    label: 'بيانات الجمعية',
    description: 'رقم التسجيل، سنة التأسيس، والمدينة.',
  },
];

const FIELDS: FieldDefinition[] = [
  {
    key: 'email',
    label: 'البريد الإلكتروني',
    type: 'email',
    ltr: true,
    group: 'contact',
  },
  {
    key: 'phone',
    label: 'رقم الهاتف الدولي',
    type: 'tel',
    ltr: true,
    group: 'contact',
  },
  {
    key: 'phoneDisplay',
    label: 'رقم الهاتف للعرض',
    type: 'tel',
    ltr: true,
    group: 'contact',
  },
  {
    key: 'youtube',
    label: 'رابط قناة يوتيوب',
    type: 'url',
    ltr: true,
    group: 'social',
  },
  {
    key: 'tiktok',
    label: 'رابط حساب تيك توك',
    type: 'url',
    ltr: true,
    group: 'social',
  },
  {
    key: 'whatsappDirect',
    label: 'رابط واتساب مباشر',
    type: 'url',
    ltr: true,
    group: 'social',
  },
  {
    key: 'whatsappGroup',
    label: 'رابط مجموعة واتساب',
    type: 'url',
    ltr: true,
    group: 'social',
  },
  {
    key: 'mapsUrl',
    label: 'رابط خرائط Google',
    type: 'url',
    ltr: true,
    group: 'location',
  },
  {
    key: 'osmCopyright',
    label: 'رابط حقوق OpenStreetMap',
    type: 'url',
    ltr: true,
    group: 'location',
  },
  {
    key: 'orgNumber',
    label: 'رقم تسجيل الجمعية',
    ltr: true,
    group: 'org',
  },
  {
    key: 'founded',
    label: 'سنة التأسيس',
    ltr: true,
    group: 'org',
  },
  {
    key: 'city',
    label: 'المدينة',
    group: 'org',
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
      'البريد، الهاتف، روابط يوتيوب وتيك توك وواتساب، رقم التسجيل، والعنوان. كل رابط في مجموعته المرتبطة.';
    copy.append(title, description);
    head.append(copy);
    container.append(head);

    const form = document.createElement('div');
    form.className = 'settings-fields';

    for (const group of GROUPS) {
      const groupFields = FIELDS.filter((field) => field.group === group.id);
      if (groupFields.length === 0) continue;

      const fieldset = document.createElement('fieldset');
      fieldset.className = 'admin-group settings-group';

      const legend = document.createElement('legend');
      legend.textContent = group.label;

      const groupDescription = document.createElement('p');
      groupDescription.className = 'settings-group__description';
      groupDescription.textContent = group.description;

      const grid = document.createElement('div');
      grid.className = 'admin-fields';

      for (const field of groupFields) {
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
        grid.append(label);
      }

      fieldset.append(legend, groupDescription, grid);
      form.append(fieldset);
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
