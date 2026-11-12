export interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  link?: string;
  linkLabel?: string;
  duration?: number;
}

export function toast(message: string, options: ToastOptions = {}): void {
  const region = document.querySelector<HTMLElement>('#toast-region');
  if (!region) return;

  const element = document.createElement('div');
  element.className = `toast toast--${options.type ?? 'success'}`;
  element.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'toast__text';
  text.textContent = message;
  element.append(text);

  if (options.link) {
    const link = document.createElement('a');
    link.className = 'toast__link';
    link.href = options.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = options.linkLabel ?? 'عرض التعديل على GitHub';
    element.append(link);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close';
  close.setAttribute('aria-label', 'إغلاق');
  close.textContent = '×';
  close.addEventListener('click', () => element.remove());
  element.append(close);

  region.append(element);
  window.setTimeout(() => element.remove(), options.duration ?? 7000);
}

export function setBusy(
  button: HTMLButtonElement,
  busy: boolean,
  busyLabel = 'جارٍ الحفظ...',
): void {
  if (busy) {
    if (!button.dataset.label) button.dataset.label = button.textContent ?? '';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = busyLabel;
    return;
  }
  button.disabled = false;
  button.removeAttribute('aria-busy');
  if (button.dataset.label) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
}

export function loadingBlock(label = 'جارٍ التحميل...'): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'admin-loading';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  spinner.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(spinner, text);
  return wrapper;
}

export function emptyState(title: string, text: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'admin-empty';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  wrapper.append(heading, paragraph);
  return wrapper;
}

export function confirmDialog(
  title: string,
  message: string,
  confirmLabel = 'تأكيد',
  danger = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.querySelector<HTMLElement>('#modal-root');
    if (!root) {
      resolve(window.confirm(message));
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.setAttribute('role', 'presentation');

    const card = document.createElement('div');
    card.className = 'modal__card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'modal-title');

    const heading = document.createElement('h2');
    heading.className = 'modal__title';
    heading.id = 'modal-title';
    heading.textContent = title;

    const paragraph = document.createElement('p');
    paragraph.className = 'modal__text';
    paragraph.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal__actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--ghost';
    cancel.textContent = 'إلغاء';

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
    confirm.textContent = confirmLabel;

    const close = (result: boolean) => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(result);
    };

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };

    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKeydown);

    actions.append(cancel, confirm);
    card.append(heading, paragraph, actions);
    overlay.append(card);
    root.append(overlay);
    cancel.focus();
  });
}

export function formatMeetingDate(date: string, lang: 'ar' | 'sv' = 'ar'): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SE' : 'sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}
