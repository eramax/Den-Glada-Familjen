import { ApiError, api, imageUrl } from './api';
import { extensionFromPath, prepareImage } from './image-utils';
import type { MetaResponse } from './types';
import { loadingBlock, toast as showToast } from './ui';
import type { ToastOptions } from './ui';

export type ImageGroup = 'identity' | 'site';

interface ImageSlot {
  path: string;
  label: string;
  description: string;
  type: 'photo' | 'logo';
  group: ImageGroup;
}

const SLOTS: ImageSlot[] = [
  {
    path: 'src/assets/images/hero.jpg',
    label: 'صورة الواجهة الرئيسية',
    description: 'تظهر في أعلى الصفحة الرئيسية.',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/about-main.jpg',
    label: 'من نحن — الصورة الرئيسية',
    description: 'الصورة الكبيرة في قسم «من نحن».',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/about-small.jpg',
    label: 'من نحن — الصورة الصغيرة',
    description: 'الصورة الصغيرة بجانب قسم «من نحن».',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/gallery-community.jpg',
    label: 'المعرض — لقاءاتنا',
    description: 'صورة «لقاءات تجمعنا» في المعرض.',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/gallery-kids.jpg',
    label: 'المعرض — إبداع الأطفال',
    description: 'صورة أنشطة الأطفال في المعرض.',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/gallery-trip.jpg',
    label: 'المعرض — الرحلات',
    description: 'صورة الرحلات العائلية في المعرض.',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/gallery-dinner.jpg',
    label: 'المعرض — الموائد',
    description: 'صورة «موائد العائلة» في المعرض.',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/meeting-dialogue.jpg',
    label: 'اللقاءات — الحوار',
    description: 'صورة توضيحية تُستخدم في اللقاء الأول.',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/meeting-workshop.jpg',
    label: 'اللقاءات — الورشة',
    description: 'صورة توضيحية تُستخدم في اللقاء الأول.',
    type: 'photo',
    group: 'site',
  },
  {
    path: 'src/assets/images/logo-full.png',
    label: 'الشعار الكامل',
    description: 'يُفضّل PNG بخلفية شفافة. يظهر في الفوتر واللوحة.',
    type: 'logo',
    group: 'identity',
  },
  {
    path: 'src/assets/images/logo-mark.png',
    label: 'علامة الشعار',
    description: 'النسخة المختصرة من الشعار.',
    type: 'logo',
    group: 'identity',
  },
  {
    path: 'public/favicon-32.png',
    label: 'أيقونة الموقع 32×32',
    description: 'تظهر في تبويب المتصفح والمفضلة.',
    type: 'logo',
    group: 'identity',
  },
  {
    path: 'public/favicon-192.png',
    label: 'أيقونة الموقع 192×192',
    description: 'تُستخدم عند تثبيت الموقع على الشاشة الرئيسية.',
    type: 'logo',
    group: 'identity',
  },
  {
    path: 'public/favicon-512.png',
    label: 'أيقونة الموقع 512×512',
    description: 'نسخة كبيرة لأيقونة الموقع.',
    type: 'logo',
    group: 'identity',
  },
  {
    path: 'public/apple-touch-icon.png',
    label: 'أيقونة Apple',
    description: 'تظهر عند إضافة الموقع إلى الشاشة الرئيسية على iOS.',
    type: 'logo',
    group: 'identity',
  },
  {
    path: 'public/og-image-ar.jpg',
    label: 'صورة المشاركة — عربي',
    description: 'تظهر عند مشاركة الموقع على وسائل التواصل (Open Graph).',
    type: 'photo',
    group: 'identity',
  },
  {
    path: 'public/og-image-sv.jpg',
    label: 'صورة المشاركة — سويدي',
    description: 'تظهر عند مشاركة النسخة السويدية على وسائل التواصل.',
    type: 'photo',
    group: 'identity',
  },
];

export interface ImagesViewOptions {
  container: HTMLElement;
  onAuthError: () => void;
}

export function createImagesView(options: ImagesViewOptions): {
  load: () => Promise<void>;
} {
  const { container, onAuthError } = options;

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

  const render = (metas: Array<MetaResponse | null>) => {
    container.replaceChildren();

    const head = document.createElement('div');
    head.className = 'view-head';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'الصور والشعار';
    const lead = document.createElement('p');
    lead.textContent =
      'كل صور الموقع، الشعار، أيقونة الموقع، وصور المشاركة في مكان واحد. تُضغط الصور تلقائيًا قبل الرفع.';
    copy.append(title, lead);
    head.append(copy);
    container.append(head);

    const note = document.createElement('p');
    note.className = 'editor-note';
    note.textContent =
      'استبدال الصورة يغيّر الملف الأصلي في المستودع، وقد تظهر الصورة نفسها في أكثر من قسم.';
    container.append(note);

    const grid = document.createElement('div');
    grid.className = 'image-grid';

    SLOTS.forEach((slot, index) => {
      let meta = metas[index];

      const card = document.createElement('article');
      card.className = 'image-card';

      const preview = document.createElement('div');
      preview.className = 'image-card__preview';

      const image = document.createElement('img');
      image.alt = slot.label;
      image.src = imageUrl(slot.path, meta?.sha);
      image.addEventListener('error', () => {
        image.hidden = true;
      });
      preview.append(image);

      const body = document.createElement('div');
      body.className = 'image-card__body';

      const label = document.createElement('h3');
      label.textContent = slot.label;

      const description = document.createElement('p');
      description.textContent = slot.description;

      const metaLine = document.createElement('span');
      metaLine.className = 'image-card__meta';
      metaLine.textContent = meta
        ? `${slot.path} · ${Math.round(meta.size / 1024)} KB`
        : `${slot.path} · غير متاحة`;

      const actions = document.createElement('div');
      actions.className = 'image-card__actions';

      const replaceLabel = document.createElement('label');
      replaceLabel.className = 'btn btn--small btn--primary';

      const replaceText = document.createElement('span');
      replaceText.textContent = 'استبدال الصورة';

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.hidden = true;

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;

        replaceText.textContent = 'جارٍ الرفع...';
        input.disabled = true;

        try {
          const prepared = await prepareImage(
            file,
            extensionFromPath(slot.path),
            slot.type === 'logo' ? 900 : 2000,
          );
          const result = await api.upload(
            slot.path,
            meta?.sha ?? '',
            prepared.base64,
          );
          meta = {
            sha: result.sha,
            size: prepared.size,
            type: 'file',
          };
          image.src = imageUrl(slot.path, result.sha);
          image.hidden = false;
          metaLine.textContent = `${slot.path} · ${Math.round(
            prepared.size / 1024,
          )} KB`;
          toast('تم رفع الصورة. ستظهر بعد إعادة البناء.', {
            link: result.commitUrl,
          });
        } catch (error) {
          handleError(error);
        } finally {
          replaceText.textContent = 'استبدال الصورة';
          input.disabled = false;
          input.value = '';
        }
      });

      replaceLabel.append(replaceText, input);
      actions.append(replaceLabel);

      body.append(label, description, metaLine, actions);
      card.append(preview, body);
      grid.append(card);
    });

    container.append(grid);

    const bottomNote = document.createElement('p');
    bottomNote.className = 'editor-note';
    bottomNote.textContent =
      'الشعار يظهر في الهيدر والفوتر واللوحة. أيقونة الموقع تُستخدم في تبويب المتصفح. صور اللقاءات تُدار من محرر اللقاء.';
    container.append(bottomNote);
  };

  const load = async () => {
    container.replaceChildren(loadingBlock('جارٍ تحميل الصور...'));
    try {
      const metas = await Promise.all(
        SLOTS.map(async (slot) => {
          try {
            return await api.getMeta(slot.path);
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) return null;
            throw error;
          }
        }),
      );
      render(metas);
    } catch (error) {
      handleError(error);
    }
  };

  return { load };
}
