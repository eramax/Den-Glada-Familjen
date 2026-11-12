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

const EMPTY_BODY = '\n<!-- يُحرَّر هذا الملف من لوحة التحكم /admin/ -->\n';

function emptyMeeting(): MeetingData {
  return {
    date: todayIso(),
    tag: { ar: '', sv: '' },
    topic: { ar: '', sv: '' },
    summary: { ar: '', sv: '' },
    takeaway: { ar: '', sv: '' },
    adults: { ar: '', sv: '' },
    children: { ar: '', sv: '' },
    lecture: { ar: '', sv: '' },
    images: [],
    video: {
      url: 'https://www.youtube.com/@dengladafamiljen7954',
      label: {
        ar: 'شاهد التسجيلات على يوتيوب',
        sv: 'Se inspelningar på YouTube',
      },
      note: {
        ar: 'تجدون تسجيلات اللقاءات على قناة الجمعية.',
        sv: 'Du hittar inspelningar från mötena på föreningens kanal.',
      },
    },
  };
}

function repoPathFromSrc(src: string): string {
  return `src/${src.replace(/^\.\.\/\.\.\//, '')}`;
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

  const renderList = () => {
    container.replaceChildren();

    const head = document.createElement('div');
    head.className = 'view-head';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'اللقاءات الأسبوعية';
    const lead = document.createElement('p');
    lead.textContent =
      'أضف لقاء كل أسبوع، وحدّث الموضوع والصور بعد انتهائه. تظهر اللقاءات في صفحة الأرشيف تلقائيًا.';
    copy.append(title, lead);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn--primary';
    add.textContent = '+ إضافة لقاء';
    add.addEventListener('click', () => {
      void openEditor(null);
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

      const tag = document.createElement('span');
      tag.className = 'meeting-card__tag';
      tag.textContent = meeting.data.tag.ar;

      const topic = document.createElement('h3');
      topic.textContent = meeting.data.topic.ar;

      const summary = document.createElement('p');
      summary.textContent = meeting.data.summary.ar;

      body.append(tag, topic, summary);

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

  const openEditor = async (meeting: LoadedMeeting | null) => {
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
    editing = meeting
      ? {
          path: meeting.file.path,
          sha: meeting.file.sha,
          data: JSON.parse(JSON.stringify(meeting.data)) as MeetingData,
          body: meeting.body,
          isNew: false,
        }
      : {
          path: '',
          sha: '',
          data: emptyMeeting(),
          body: EMPTY_BODY,
          isNew: true,
        };

    renderEditor();
  };

  const renderEditor = () => {
    if (!editing) return;
    container.replaceChildren();

    const data = editing.data;

    const head = document.createElement('div');
    head.className = 'view-head view-head--editor';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = editing.isNew ? 'إضافة لقاء' : 'تعديل اللقاء';
    const lead = document.createElement('p');
    lead.textContent = editing.isNew
      ? 'سيُنشأ ملف MD جديد باسم تاريخ اللقاء.'
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
    dateInput.disabled = !editing.isNew;

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
    basics.append(field('تاريخ اللقاء', dateInput), dateHint);

    basics.append(
      localizedPair('الوسم (مثال: غدًا / الأحد الماضي)', data.tag, markDirty),
      localizedPair('موضوع اللقاء', data.topic, markDirty),
      localizedPair('ملخص اللقاء', data.summary, markDirty, true),
      localizedPair('الخلاصة', data.takeaway, markDirty, true),
    );

    container.append(
      section(
        'بيانات اللقاء',
        'التاريخ والوسم والموضوع والملخص الذي يظهر في البطاقة.',
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

    const video = document.createElement('div');
    video.className = 'editor-card__body';

    const url = document.createElement('input');
    url.type = 'url';
    url.dir = 'ltr';
    url.className = 'admin-input';
    url.value = data.video.url;
    url.addEventListener('input', () => {
      data.video.url = url.value;
      markDirty();
    });
    video.append(
      field('رابط الفيديو (YouTube)', url),
      localizedPair('نص زر الفيديو', data.video.label, markDirty),
      localizedPair('ملاحظة الفيديو', data.video.note, markDirty, true),
    );
    container.append(
      section(
        'الفيديو',
        'اترك الرابط إلى قناة الجمعية أو ضع رابط التسجيل مباشرة.',
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
        preview.src = imageUrl(repoPathFromSrc(image.src));
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
          void uploadMeetingImage(file, image, onChange);
        });
        replaceLabel.append(replaceInput);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn--small btn--danger-ghost';
        remove.textContent = 'حذف';
        remove.addEventListener('click', () => {
          data.images.splice(index, 1);
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
          void uploadMeetingImage(file, null, onChange);
        });

        addLabel.append(addInput);
        grid.append(addLabel);
      }
    };

    const uploadMeetingImage = async (
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
        const path = `src/assets/images/uploads/${filename}`;
        await api.upload(path, '', prepared.base64);

        const src = `../../assets/images/uploads/${filename}`;
        if (target) {
          target.src = src;
        } else {
          data.images.push({ src, alt: { ar: '', sv: '' } });
        }

        onChange();
        render();
        toast('تم رفع الصورة. اضغط «حفظ ونشر» لتثبيت التغيير.', {
          type: 'info',
        });
      } catch (error) {
        handleError(error);
      }
    };

    render();
    body.append(grid);

    const note = document.createElement('p');
    note.className = 'editor-note';
    note.textContent =
      'الصور تُضغط تلقائيًا قبل الرفع. بعد رفع صورة جديدة اضغط «حفظ ونشر».';
    body.append(note);

    return section(
      'صور اللقاء',
      'أضف من صورة إلى 4 صور. الصورة الأولى تظهر بعرض أكبر.',
      body,
    );
  };

  const saveMeeting = async (button: HTMLButtonElement) => {
    if (!editing) return;
    const data = editing.data;

    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      toast('اختر تاريخ اللقاء أولًا.', { type: 'error' });
      return;
    }
    for (const [name, value] of Object.entries({
      'الوسم': data.tag,
      'الموضوع': data.topic,
      'الملخص': data.summary,
      'الخلاصة': data.takeaway,
      'نشاط الكبار': data.adults,
      'نشاط الأطفال': data.children,
      'وصف المحاضرة': data.lecture,
      'نص زر الفيديو': data.video.label,
      'ملاحظة الفيديو': data.video.note,
    })) {
      if (!value.ar.trim() || !value.sv.trim()) {
        toast(`املأ ${name} بالعربية والسويدية.`, { type: 'error' });
        return;
      }
    }
    if (!/^https?:\/\//.test(data.video.url)) {
      toast('أدخل رابط فيديو صالحًا يبدأ بـ http أو https.', {
        type: 'error',
      });
      return;
    }
    if (data.images.length === 0) {
      toast('أضف صورة واحدة على الأقل.', { type: 'error' });
      return;
    }
    for (const [index, image] of data.images.entries()) {
      if (!image.alt.ar.trim() || !image.alt.sv.trim()) {
        toast(`أضف وصف الصورة ${index + 1} بالعربية والسويدية.`, {
          type: 'error',
        });
        return;
      }
    }

    const path = `src/content/meetings/${data.date}.md`;

    if (editing.isNew) {
      try {
        await api.getContent(path);
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
      const text = serializeMarkdown(data, editing.body);
      const result = await api.saveContent(
        path,
        editing.isNew ? '' : editing.sha,
        text,
      );
      markClean();
      toast('تم حفظ اللقاء. سيظهر التعديل بعد إعادة البناء.', {
        link: result.commitUrl,
      });
      editing = null;
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
          return { file, data: parsed.data, body: parsed.body };
        }),
      );

      meetings = loaded.sort((a, b) =>
        b.data.date.localeCompare(a.data.date),
      );
      editing = null;
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
