import { ApiError, api, imageUrl } from './api';
import { imageExtensionForFile, prepareImage } from './image-utils';
import { parseMarkdown, serializeMarkdown } from './markdown';
import type { FileEntry, Localized, MeetingData, MeetingImage } from './types';
import {
  formatMeetingDate,
  loadingBlock,
  setBusy,
  todayIso,
  toast as showToast,
} from './ui';
import type { ToastOptions } from './ui';

export interface MeetingsViewOptions {
  container: HTMLElement;
  setDirty: (dirty: boolean) => void;
  confirm: (
    title: string,
    message: string,
    confirmLabel?: string,
    danger?: boolean,
  ) => Promise<boolean>;
  onAuthError: () => void;
}

interface LoadedMeeting {
  file: FileEntry;
  data: MeetingData;
  body: string;
}

interface EditingMeeting {
  path: string;
  sha: string;
  data: MeetingData;
  body: string;
  isNew: boolean;
}

interface PendingImage {
  base64: string;
  previewUrl: string;
}

const EMPTY_BODY = '\n<!-- يُحرَّر هذا الملف من لوحة التحكم /admin/ -->\n';

function defaultVideo(): NonNullable<MeetingData['video']> {
  return {
    url: '',
    label: { ar: '', sv: '' },
    note: { ar: '', sv: '' },
  };
}

function emptyMeeting(date = todayIso()): MeetingData {
  return {
    date,
    topic: { ar: '', sv: '' },
    summary: { ar: '', sv: '' },
    adults: { ar: '', sv: '' },
    children: { ar: '', sv: '' },
    lecture: { ar: '', sv: '' },
    images: [],
    video: defaultVideo(),
  };
}

function normalizeMeeting(data: MeetingData): MeetingData {
  return {
    ...data,
    images: Array.isArray(data.images) ? data.images : [],
    video: data.video ?? defaultVideo(),
  };
}

function repoPathFromSrc(src: string): string {
  return `src/${src.replace(/^\.\.\/\.\.\//, '')}`;
}

function base64ToBlob(base64: string, extension: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const type =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : 'image/jpeg';
  return new Blob([bytes], { type });
}

function localizedPair(
  labelText: string,
  value: Localized,
  onChange: () => void,
  multiline = false,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'localized-field';

  const title = document.createElement('span');
  title.className = 'localized-field__label';
  title.textContent = labelText;

  const grid = document.createElement('div');
  grid.className = 'localized-grid';

  for (const lang of ['ar', 'sv'] as const) {
    const label = document.createElement('label');
    label.className = 'localized-input';

    const badge = document.createElement('span');
    badge.className = 'localized-input__badge';
    badge.textContent = lang === 'ar' ? 'AR' : 'SV';

    const control = multiline
      ? document.createElement('textarea')
      : document.createElement('input');
    control.className = multiline ? 'admin-textarea' : 'admin-input';
    control.value = value[lang];
    control.dir = lang === 'ar' ? 'rtl' : 'ltr';
    control.lang = lang;
    control.setAttribute(
      'aria-label',
      `${labelText} — ${lang === 'ar' ? 'العربية' : 'Svenska'}`,
    );
    if (control instanceof HTMLTextAreaElement) control.rows = 3;
    control.addEventListener('input', () => {
      value[lang] = control.value;
      onChange();
    });

    label.append(badge, control);
    grid.append(label);
  }

  group.append(title, grid);
  return group;
}

function field(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'admin-field';
  const caption = document.createElement('span');
  caption.className = 'admin-field__label';
  caption.textContent = labelText;
  label.append(caption, control);
  return label;
}

function section(
  title: string,
  subtitle: string,
  ...children: HTMLElement[]
): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'editor-card';

  const head = document.createElement('div');
  head.className = 'editor-card__head';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const text = document.createElement('p');
  text.textContent = subtitle;

  const body = document.createElement('div');
  body.className = 'editor-card__body';
  body.append(...children);

  head.append(heading, text);
  wrapper.append(head, body);
  return wrapper;
}

export function createMeetingsView(options: MeetingsViewOptions): {
  load: () => Promise<void>;
} {
  const { container, setDirty, confirm, onAuthError } = options;

  let meetings: LoadedMeeting[] = [];
  let editing: EditingMeeting | null = null;
  let dirty = false;
  let statusElement: HTMLElement | null = null;
  const pendingImages = new Map<string, PendingImage>();

  const markDirty = () => {
    dirty = true;
    setDirty(true);
    if (statusElement) {
      statusElement.textContent = 'تغييرات غير محفوظة';
      statusElement.classList.add('is-dirty');
    }
  };

  const markClean = () => {
    dirty = false;
    setDirty(false);
    if (statusElement) {
      statusElement.textContent = 'كل التغييرات محفوظة';
      statusElement.classList.remove('is-dirty');
    }
  };

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

  const clearPendingImages = () => {
    for (const pending of pendingImages.values()) {
      URL.revokeObjectURL(pending.previewUrl);
    }
    pendingImages.clear();
  };

  const renderList = () => {
    container.replaceChildren();

    const head = document.createElement('div');
    head.className = 'view-head';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'اللقاءات الأسبوعية';
    const lead = document.createElement('p');
    lead.textContent =
      'أضف لقاء كل أسبوع، وحدّث الموضوع والصور بعد انتهائه. يمكن حفظ اللقاء بدون صور أو فيديو.';
    copy.append(title, lead);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn--primary';
    add.textContent = '+ إضافة لقاء';
    add.addEventListener('click', () => {
      openAddModal();
    });

    head.append(copy, add);
    container.append(head);

    if (meetings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      const emptyTitle = document.createElement('strong');
      emptyTitle.textContent = 'لا توجد لقاءات بعد';
      const emptyText = document.createElement('p');
      emptyText.textContent = 'ابدأ بإضافة أول لقاء.';
      empty.append(emptyTitle, emptyText);
      container.append(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'meetings-list';

    for (const meeting of meetings) {
      const card = document.createElement('article');
      card.className = 'meeting-card';

      const date = document.createElement('span');
      date.className = 'meeting-card__date';
      date.textContent = formatMeetingDate(meeting.data.date, 'ar');

      const status = document.createElement('span');
      const isUpcoming = meeting.data.date >= todayIso();
      status.className = `meeting-card__status ${
        isUpcoming ? 'is-upcoming' : 'is-past'
      }`;
      status.textContent = isUpcoming ? 'قادم' : 'مؤرشف';

      const body = document.createElement('div');
      body.className = 'meeting-card__body';

      const topic = document.createElement('h3');
      topic.textContent = meeting.data.topic.ar;

      const summary = document.createElement('p');
      summary.textContent = meeting.data.summary.ar;

      body.append(topic, summary);

      const actions = document.createElement('div');
      actions.className = 'meeting-card__actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn--small btn--ghost';
      edit.textContent = 'تعديل';
      edit.addEventListener('click', () => {
        void openEditor(meeting);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--small btn--danger-ghost';
      remove.textContent = 'حذف';
      remove.addEventListener('click', () => {
        void deleteMeeting(meeting);
      });

      actions.append(edit, remove);
      card.append(date, status, body, actions);
      list.append(card);
    }

    container.append(list);
  };

  const openAddModal = () => {
    const root = document.querySelector<HTMLElement>('#modal-root');
    if (!root) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal';

    const card = document.createElement('div');
    card.className = 'modal__card modal__card--wide';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'add-meeting-title');

    const title = document.createElement('h2');
    title.className = 'modal__title';
    title.id = 'add-meeting-title';
    title.textContent = 'إضافة لقاء';

    const lead = document.createElement('p');
    lead.className = 'modal__text';
    lead.textContent =
      'اختر تاريخ اللقاء واكتب الموضوع والملخص. يمكنك إضافة الصور والفيديو بعد ذلك.';

    const form = document.createElement('div');
    form.className = 'modal__form';

    const date = document.createElement('input');
    date.type = 'date';
    date.className = 'admin-input';
    date.value = todayIso();

    const dateHint = document.createElement('p');
    dateHint.className = 'editor-hint';
    const updateDateHint = () => {
      dateHint.textContent = date.value
        ? `${date.value} · ${formatMeetingDate(date.value, 'ar')}`
        : 'اختر تاريخ اللقاء';
    };
    updateDateHint();
    date.addEventListener('input', updateDateHint);

    const dateField = document.createElement('label');
    dateField.className = 'admin-field';
    const dateLabel = document.createElement('span');
    dateLabel.className = 'admin-field__label';
    dateLabel.textContent = 'تاريخ اللقاء';
    dateField.append(dateLabel, dateHint, date);

    const topic = { ar: '', sv: '' };
    const summary = { ar: '', sv: '' };

    form.append(
      dateField,
      localizedPair('موضوع اللقاء', topic, () => {}),
      localizedPair('ملخص اللقاء', summary, () => {}, true),
    );

    const error = document.createElement('p');
    error.className = 'login__error';
    error.setAttribute('role', 'alert');
    error.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'modal__actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--ghost';
    cancel.textContent = 'إلغاء';

    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'btn btn--primary';
    create.textContent = 'إنشاء ومتابعة';

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    const close = () => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
    };

    cancel.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });

    document.addEventListener('keydown', onKeydown);

    create.addEventListener('click', () => {
      if (!date.value || !/^\d{4}-\d{2}-\d{2}$/.test(date.value)) {
        error.textContent = 'اختر تاريخ اللقاء.';
        error.hidden = false;
        return;
      }
      if (!topic.ar.trim() || !topic.sv.trim() || !summary.ar.trim() || !summary.sv.trim()) {
        error.textContent = 'املأ الموضوع والملخص بالعربية والسويدية.';
        error.hidden = false;
        return;
      }
      if (meetings.some((meeting) => meeting.data.date === date.value)) {
        error.textContent = 'يوجد لقاء بهذا التاريخ بالفعل.';
        error.hidden = false;
        return;
      }

      const data = emptyMeeting(date.value);
      data.topic = topic;
      data.summary = summary;
      editing = {
        path: '',
        sha: '',
        data,
        body: EMPTY_BODY,
        isNew: true,
      };
      pendingImages.clear();
      markClean();
      close();
      renderEditor();
    });

    actions.append(cancel, create);
    card.append(title, lead, form, error, actions);
    overlay.append(card);
    root.append(overlay);
    date.focus();
  };

  const openEditor = async (meeting: LoadedMeeting) => {
    if (dirty) {
      const discard = await confirm(
        'تغييرات غير محفوظة',
        'هل تريد تجاهل التغييرات والانتقال؟',
        'تجاهل',
        true,
      );
      if (!discard) return;
    }

    markClean();
    clearPendingImages();
    const data = normalizeMeeting(
      JSON.parse(JSON.stringify(meeting.data)) as MeetingData,
    );

    editing = {
      path: meeting.file.path,
      sha: meeting.file.sha,
      data,
      body: meeting.body,
      isNew: false,
    };

    renderEditor();
  };

  const renderEditor = () => {
    if (!editing) return;
    container.replaceChildren();

    const data = editing.data;
    data.video ??= defaultVideo();

    const head = document.createElement('div');
    head.className = 'view-head view-head--editor';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = editing.isNew ? 'إضافة لقاء' : 'تعديل اللقاء';
    const lead = document.createElement('p');
    lead.textContent = editing.isNew
      ? 'سيُنشأ ملف MD جديد باسم تاريخ اللقاء عند الحفظ.'
      : `الملف: ${editing.path}`;
    copy.append(title, lead);

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn--ghost';
    back.textContent = 'رجوع إلى اللقاءات';
    back.addEventListener('click', () => {
      void closeEditor();
    });

    head.append(copy, back);
    container.append(head);

    const basics = document.createElement('div');
    basics.className = 'editor-card__body';

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'admin-input';
    dateInput.value = data.date;

    const dateHint = document.createElement('p');
    dateHint.className = 'editor-hint';
    const updateDateHint = () => {
      dateHint.textContent = data.date
        ? `${data.date} · ${formatMeetingDate(data.date, 'ar')}`
        : 'اختر تاريخ اللقاء';
    };
    updateDateHint();

    dateInput.addEventListener('input', () => {
      data.date = dateInput.value;
      updateDateHint();
      markDirty();
    });

    const dateField = document.createElement('label');
    dateField.className = 'admin-field';
    const dateLabel = document.createElement('span');
    dateLabel.className = 'admin-field__label';
    dateLabel.textContent = 'تاريخ اللقاء';
    dateField.append(dateLabel, dateHint, dateInput);
    basics.append(dateField);

    basics.append(
      localizedPair('موضوع اللقاء', data.topic, markDirty),
      localizedPair('ملخص اللقاء', data.summary, markDirty, true),
    );

    container.append(
      section(
        'بيانات اللقاء',
        'التاريخ والموضوع والملخص الذي يظهر في البطاقة.',
        basics,
      ),
    );

    const activities = document.createElement('div');
    activities.className = 'editor-card__body';
    activities.append(
      localizedPair('نشاط الكبار', data.adults, markDirty, true),
      localizedPair('نشاط الأطفال', data.children, markDirty, true),
      localizedPair('وصف المحاضرة', data.lecture, markDirty, true),
    );
    container.append(
      section(
        'الأنشطة والمحاضرة',
        'وصف مختصر لما حدث في اللقاء للكبار والأطفال.',
        activities,
      ),
    );

    container.append(renderImagesSection(data, markDirty));

    const videoData = data.video ?? defaultVideo();
    const video = document.createElement('div');
    video.className = 'editor-card__body';

    const url = document.createElement('input');
    url.type = 'url';
    url.dir = 'ltr';
    url.className = 'admin-input';
    url.value = videoData.url;
    url.addEventListener('input', () => {
      videoData.url = url.value;
      markDirty();
    });
    video.append(
      field('رابط الفيديو (اختياري)', url),
      localizedPair('نص زر الفيديو', videoData.label, markDirty),
      localizedPair('ملاحظة الفيديو', videoData.note, markDirty, true),
    );
    container.append(
      section(
        'الفيديو (اختياري)',
        'اترك الرابط فارغًا إذا لم يكن هناك تسجيل. يمكن حفظ اللقاء بدونه.',
        video,
      ),
    );

    const bar = document.createElement('div');
    bar.className = 'admin-savebar';

    statusElement = document.createElement('span');
    statusElement.className = 'admin-savebar__status';
    statusElement.textContent = dirty
      ? 'تغييرات غير محفوظة'
      : 'كل التغييرات محفوظة';
    if (dirty) statusElement.classList.add('is-dirty');

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn btn--primary';
    save.textContent = 'حفظ ونشر';
    save.addEventListener('click', () => {
      void saveMeeting(save);
    });

    bar.append(statusElement, save);
    container.append(bar);
  };

  const renderImagesSection = (
    data: MeetingData,
    onChange: () => void,
  ): HTMLElement => {
    const body = document.createElement('div');
    body.className = 'editor-card__body';

    const grid = document.createElement('div');
    grid.className = 'meeting-images';

    const render = () => {
      grid.replaceChildren();

      data.images.forEach((image, index) => {
        const card = document.createElement('div');
        card.className = 'meeting-image';

        const preview = document.createElement('img');
        preview.className = 'meeting-image__preview';
        preview.src =
          pendingImages.get(image.src)?.previewUrl ??
          imageUrl(repoPathFromSrc(image.src));
        preview.alt = image.alt.ar || `صورة ${index + 1}`;

        const controls = document.createElement('div');
        controls.className = 'meeting-image__controls';

        const altAr = document.createElement('input');
        altAr.className = 'admin-input';
        altAr.placeholder = 'وصف الصورة بالعربية';
        altAr.setAttribute('aria-label', 'وصف الصورة بالعربية');
        altAr.dir = 'rtl';
        altAr.value = image.alt.ar;
        altAr.addEventListener('input', () => {
          image.alt.ar = altAr.value;
          onChange();
        });

        const altSv = document.createElement('input');
        altSv.className = 'admin-input';
        altSv.placeholder = 'Bildbeskrivning på svenska';
        altSv.setAttribute('aria-label', 'Bildbeskrivning på svenska');
        altSv.dir = 'ltr';
        altSv.value = image.alt.sv;
        altSv.addEventListener('input', () => {
          image.alt.sv = altSv.value;
          onChange();
        });

        const actions = document.createElement('div');
        actions.className = 'meeting-image__actions';

        const replaceLabel = document.createElement('label');
        replaceLabel.className = 'btn btn--small btn--ghost';
        replaceLabel.textContent = 'استبدال';
        const replaceInput = document.createElement('input');
        replaceInput.type = 'file';
        replaceInput.accept = 'image/jpeg,image/png,image/webp';
        replaceInput.hidden = true;
        replaceInput.addEventListener('change', () => {
          const file = replaceInput.files?.[0];
          if (!file) return;
          void stageMeetingImage(file, image, onChange);
        });
        replaceLabel.append(replaceInput);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn--small btn--danger-ghost';
        remove.textContent = 'حذف';
        remove.addEventListener('click', () => {
          const removed = data.images.splice(index, 1)[0];
          if (removed) {
            const pending = pendingImages.get(removed.src);
            if (pending) {
              URL.revokeObjectURL(pending.previewUrl);
              pendingImages.delete(removed.src);
            }
          }
          onChange();
          render();
        });

        actions.append(replaceLabel, remove);
        controls.append(altAr, altSv, actions);
        card.append(preview, controls);
        grid.append(card);
      });

      if (data.images.length < 4) {
        const addLabel = document.createElement('label');
        addLabel.className = 'meeting-image meeting-image--add';
        addLabel.textContent = '+ إضافة صورة';

        const addInput = document.createElement('input');
        addInput.type = 'file';
        addInput.accept = 'image/jpeg,image/png,image/webp';
        addInput.hidden = true;
        addInput.addEventListener('change', () => {
          const file = addInput.files?.[0];
          if (!file) return;
          void stageMeetingImage(file, null, onChange);
        });

        addLabel.append(addInput);
        grid.append(addLabel);
      }
    };

    const stageMeetingImage = async (
      file: File,
      target: MeetingImage | null,
      onChange: () => void,
    ) => {
      try {
        const extension = imageExtensionForFile(file);
        const prepared = await prepareImage(file, extension, 1800);
        const filename = `meeting-${data.date || 'draft'}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${extension}`;
        const src = `../../assets/images/uploads/${filename}`;
        const previewUrl = URL.createObjectURL(
          base64ToBlob(prepared.base64, extension),
        );

        if (target) {
          const oldPending = pendingImages.get(target.src);
          if (oldPending) {
            URL.revokeObjectURL(oldPending.previewUrl);
            pendingImages.delete(target.src);
          }
          target.src = src;
        } else {
          data.images.push({ src, alt: { ar: '', sv: '' } });
        }

        pendingImages.set(src, {
          base64: prepared.base64,
          previewUrl,
        });
        onChange();
        render();
      } catch (error) {
        handleError(error);
      }
    };

    render();
    body.append(grid);

    const note = document.createElement('p');
    note.className = 'editor-note';
    note.textContent =
      'الصور اختيارية. تُضغط محليًا وتُرفع عند الضغط على «حفظ ونشر».';
    body.append(note);

    return section(
      'صور اللقاء (اختيارية)',
      'أضف حتى 4 صور. يمكن حفظ اللقاء بدون صور.',
      body,
    );
  };

  const uploadPendingImages = async () => {
    for (const [src, pending] of Array.from(pendingImages)) {
      const path = repoPathFromSrc(src);
      let sha = '';
      try {
        const meta = await api.getMeta(path);
        sha = meta.sha;
      } catch {
        // New file.
      }
      await api.upload(path, sha, pending.base64);
      pendingImages.delete(src);
      URL.revokeObjectURL(pending.previewUrl);
    }
  };

  const saveMeeting = async (button: HTMLButtonElement) => {
    if (!editing) return;
    const data = editing.data;

    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      toast('اختر تاريخ اللقاء أولًا.', { type: 'error' });
      return;
    }
    for (const [name, value] of Object.entries({
      'الموضوع': data.topic,
      'الملخص': data.summary,
      'نشاط الكبار': data.adults,
      'نشاط الأطفال': data.children,
      'وصف المحاضرة': data.lecture,
    })) {
      if (!value.ar.trim() || !value.sv.trim()) {
        toast(`املأ ${name} بالعربية والسويدية.`, { type: 'error' });
        return;
      }
    }

    for (const [index, image] of data.images.entries()) {
      if (!image.alt.ar.trim() || !image.alt.sv.trim()) {
        toast(`أضف وصف الصورة ${index + 1} بالعربية والسويدية.`, {
          type: 'error',
        });
        return;
      }
    }

    const videoUrl = data.video?.url.trim() ?? '';
    if (videoUrl) {
      if (!/^https?:\/\//.test(videoUrl)) {
        toast('أدخل رابط فيديو صالحًا يبدأ بـ http أو https.', {
          type: 'error',
        });
        return;
      }
      if (!data.video?.label.ar.trim() || !data.video?.label.sv.trim()) {
        toast('املأ نص زر الفيديو بالعربية والسويدية.', { type: 'error' });
        return;
      }
      if (!data.video?.note.ar.trim() || !data.video?.note.sv.trim()) {
        toast('املأ ملاحظة الفيديو بالعربية والسويدية.', { type: 'error' });
        return;
      }
    }

    const newPath = `src/content/meetings/${data.date}.md`;
    const dateChanged = !editing.isNew && editing.path !== newPath;

    if (editing.isNew || dateChanged) {
      try {
        await api.getContent(newPath);
        toast('يوجد لقاء بهذا التاريخ بالفعل. اختر تاريخًا آخر.', {
          type: 'error',
        });
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) {
          handleError(error);
          return;
        }
      }
    }

    setBusy(button, true);
    try {
      await uploadPendingImages();

      const payload: MeetingData = JSON.parse(JSON.stringify(data));
      if (!payload.video || !payload.video.url.trim()) {
        delete payload.video;
      }

      const text = serializeMarkdown(payload, editing.body);
      let saved;

      if (editing.isNew || dateChanged) {
        saved = await api.saveContent(newPath, '', text);
        if (dateChanged) {
          try {
            await api.deleteContent(editing.path, editing.sha);
          } catch (error) {
            toast(
              'تم إنشاء الملف الجديد، لكن تعذّر حذف الملف القديم. احذفه يدويًا من GitHub.',
              { type: 'error' },
            );
            handleError(error);
          }
        }
      } else {
        saved = await api.saveContent(newPath, editing.sha, text);
      }

      editing.path = newPath;
      editing.sha = saved.sha;
      editing.isNew = false;

      markClean();
      toast(
        dateChanged
          ? 'تم حفظ اللقاء ونقل الملف إلى التاريخ الجديد.'
          : 'تم حفظ اللقاء. سيظهر التعديل بعد إعادة البناء.',
        { link: saved.commitUrl },
      );
      editing = null;
      clearPendingImages();
      await load();
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(button, false);
    }
  };

  const closeEditor = async () => {
    if (dirty) {
      const discard = await confirm(
        'تغييرات غير محفوظة',
        'هل تريد تجاهل التغييرات؟',
        'تجاهل',
        true,
      );
      if (!discard) return;
    }
    editing = null;
    clearPendingImages();
    markClean();
    renderList();
  };

  const deleteMeeting = async (meeting: LoadedMeeting) => {
    const confirmed = await confirm(
      'حذف اللقاء',
      `سيتم حذف ملف ${meeting.data.topic.ar} من المستودع. هل أنت متأكد؟`,
      'حذف',
      true,
    );
    if (!confirmed) return;

    try {
      const result = await api.deleteContent(
        meeting.file.path,
        meeting.file.sha,
      );
      toast('تم حذف اللقاء.', { link: result.commitUrl });
      await load();
    } catch (error) {
      handleError(error);
    }
  };

  const load = async () => {
    container.replaceChildren(loadingBlock('جارٍ تحميل اللقاءات...'));
    try {
      const { files } = await api.listMeetings();
      const markdownFiles = files.filter((file) => file.name.endsWith('.md'));

      const loaded = await Promise.all(
        markdownFiles.map(async (file) => {
          const content = await api.getContent(file.path);
          const parsed = parseMarkdown<MeetingData>(content.text);
          return {
            file,
            data: normalizeMeeting(parsed.data),
            body: parsed.body,
          };
        }),
      );

      meetings = loaded.sort((a, b) =>
        b.data.date.localeCompare(a.data.date),
      );
      editing = null;
      clearPendingImages();
      markClean();
      renderList();
    } catch (error) {
      handleError(error);
      container.replaceChildren();
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn--primary';
      retry.textContent = 'إعادة المحاولة';
      retry.addEventListener('click', () => {
        void load();
      });
      container.append(retry);
    }
  };

  return { load };
}
