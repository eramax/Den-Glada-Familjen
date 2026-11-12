import { ApiError, api } from './api';
import { renderPageForm } from './form';
import { createImagesView } from './images';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { createMeetingsView } from './meetings';
import type { PageData } from './types';
import {
  confirmDialog,
  loadingBlock,
  setBusy,
  toast,
} from './ui';

type PageTab = 'home' | 'meetingsPage' | 'site';
type Tab = PageTab | 'meetings' | 'images';

interface PageDefinition {
  path: string;
  title: string;
  description: string;
  preview: string;
}

const PAGES: Record<PageTab, PageDefinition> = {
  home: {
    path: 'src/content/pages/home.md',
    title: 'الصفحة الرئيسية',
    description:
      'نصوص الواجهة، من نحن، الأنشطة، المعرض، الانضمام، الأسئلة الشائعة، والتواصل.',
    preview: '/',
  },
  meetingsPage: {
    path: 'src/content/pages/meetings.md',
    title: 'صفحة اللقاءات',
    description:
      'موعد اللقاء، المكان، بطاقات التنسيق، ونصوص صفحة الأرشيف.',
    preview: '/meetings/',
  },
  site: {
    path: 'src/content/pages/site.md',
    title: 'الهوية والتنقل',
    description:
      'اسم الجمعية، القائمة، نصوص إمكانية الوصول، والفوتر.',
    preview: '/',
  },
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'meetings', label: 'اللقاءات' },
  { id: 'meetingsPage', label: 'صفحة اللقاءات' },
  { id: 'site', label: 'الهوية والتنقل' },
  { id: 'images', label: 'الصور' },
];

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing admin element: ${selector}`);
  return element;
}

const loginView = must<HTMLElement>('#login-view');
const appView = must<HTMLElement>('#app-view');
const loginForm = must<HTMLFormElement>('#login-form');
const loginUsername = must<HTMLInputElement>('#login-username');
const loginPassword = must<HTMLInputElement>('#login-password');
const loginError = must<HTMLElement>('#login-error');
const loginSubmit = must<HTMLButtonElement>('#login-submit');
const appMain = must<HTMLElement>('#app-main');
const appTabs = must<HTMLElement>('#app-tabs');
const userName = must<HTMLElement>('#user-name');
const logoutButton = must<HTMLButtonElement>('#logout-button');

let activeTab: Tab = 'home';
let dirty = false;
let renderToken = 0;

function setDirty(value: boolean): void {
  dirty = value;
}

function showLogin(message?: string): void {
  setDirty(false);
  activeTab = 'home';
  renderToken += 1;
  appMain.replaceChildren();
  appView.hidden = true;
  loginView.hidden = false;
  loginError.textContent = message ?? '';
  loginError.hidden = !message;
  loginPassword.value = '';
  loginUsername.focus();
}

function showApp(user: string): void {
  setDirty(false);
  loginView.hidden = true;
  appView.hidden = false;
  userName.textContent = user;
  renderTabs();
  void activate('home');
}

async function guard<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      showLogin('انتهت الجلسة. سجّل الدخول من جديد.');
      return null;
    }
    toast(
      error instanceof Error ? error.message : 'حدث خطأ غير متوقع.',
      { type: 'error' },
    );
    return null;
  }
}

function renderTabs(): void {
  appTabs.replaceChildren();
  for (const tab of TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app__tab';
    button.dataset.tab = tab.id;
    button.textContent = tab.label;
    button.addEventListener('click', () => {
      void activate(tab.id);
    });
    appTabs.append(button);
  }
}

function updateTabs(): void {
  appTabs.querySelectorAll<HTMLButtonElement>('.app__tab').forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

async function activate(tab: Tab): Promise<void> {
  if (tab === activeTab && appMain.childElementCount > 0) return;

  if (dirty) {
    const discard = await confirmDialog(
      'تغييرات غير محفوظة',
      'هل تريد تجاهل التغييرات والانتقال؟',
      'تجاهل',
      true,
    );
    if (!discard) return;
    setDirty(false);
  }

  activeTab = tab;
  updateTabs();
  appMain.replaceChildren();

  if (tab === 'meetings') {
    const panel = document.createElement('div');
    appMain.append(panel);
    const view = createMeetingsView({
      container: panel,
      setDirty,
      confirm: confirmDialog,
      onAuthError: () => showLogin('انتهت الجلسة. سجّل الدخول من جديد.'),
    });
    await view.load();
    return;
  }

  if (tab === 'images') {
    const panel = document.createElement('div');
    appMain.append(panel);
    const view = createImagesView({
      container: panel,
      onAuthError: () => showLogin('انتهت الجلسة. سجّل الدخول من جديد.'),
    });
    await view.load();
    return;
  }

  await renderPage(tab);
}

async function renderPage(tab: PageTab): Promise<void> {
  const definition = PAGES[tab];
  const token = ++renderToken;
  appMain.append(loadingBlock('جارٍ تحميل المحتوى...'));

  const response = await guard(() => api.getContent(definition.path));
  if (token !== renderToken) return;
  if (!response) {
    appMain.replaceChildren();
    return;
  }

  let parsed: ReturnType<typeof parseMarkdown<PageData>>;
  try {
    parsed = parseMarkdown<PageData>(response.text);
  } catch (error) {
    appMain.replaceChildren();
    toast(
      error instanceof Error ? error.message : 'تعذّر قراءة الملف.',
      { type: 'error' },
    );
    return;
  }

  appMain.replaceChildren();

  const page = {
    path: definition.path,
    sha: response.sha,
    data: parsed.data,
    body: parsed.body,
  };

  const head = document.createElement('div');
  head.className = 'view-head';

  const copy = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = definition.title;
  const description = document.createElement('p');
  description.textContent = definition.description;
  copy.append(title, description);

  const preview = document.createElement('a');
  preview.className = 'btn btn--ghost';
  preview.href = definition.preview;
  preview.target = '_blank';
  preview.rel = 'noopener noreferrer';
  preview.textContent = 'معاينة الصفحة';

  head.append(copy, preview);

  const formContainer = document.createElement('div');
  formContainer.className = 'editor-form';

  const bar = document.createElement('div');
  bar.className = 'admin-savebar';

  const status = document.createElement('span');
  status.className = 'admin-savebar__status';
  status.textContent = 'كل التغييرات محفوظة';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn btn--primary';
  save.textContent = 'حفظ ونشر';

  const markDirty = () => {
    setDirty(true);
    status.textContent = 'تغييرات غير محفوظة';
    status.classList.add('is-dirty');
  };

  renderPageForm(formContainer, parsed.data, markDirty);

  save.addEventListener('click', async () => {
    setBusy(save, true);
    try {
      const text = serializeMarkdown(page.data, page.body);
      const saved = await api.saveContent(page.path, page.sha, text);
      page.sha = saved.sha;
      setDirty(false);
      status.textContent = 'تم الحفظ — سيظهر الموقع خلال 1–2 دقيقة.';
      status.classList.remove('is-dirty');
      toast('تم حفظ الصفحة. سيظهر التعديل بعد إعادة البناء.', {
        link: saved.commitUrl,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showLogin('انتهت الجلسة. سجّل الدخول من جديد.');
        return;
      }
      toast(
        error instanceof Error ? error.message : 'تعذّر حفظ الصفحة.',
        { type: 'error' },
      );
    } finally {
      setBusy(save, false);
    }
  });

  bar.append(status, save);
  appMain.append(head, formContainer, bar);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = loginUsername.value.trim();
  const password = loginPassword.value;

  if (!username || !password) {
    loginError.textContent = 'أدخل اسم المستخدم وكلمة السر.';
    loginError.hidden = false;
    return;
  }

  loginError.hidden = true;
  setBusy(loginSubmit, true, 'جارٍ الدخول...');

  try {
    const result = await api.login(username, password);
    loginPassword.value = '';
    showApp(result.user);
  } catch (error) {
    loginError.textContent =
      error instanceof Error ? error.message : 'تعذّر تسجيل الدخول.';
    loginError.hidden = false;
    loginPassword.select();
  } finally {
    setBusy(loginSubmit, false);
  }
});

logoutButton.addEventListener('click', async () => {
  if (dirty) {
    const discard = await confirmDialog(
      'تغييرات غير محفوظة',
      'هل تريد تجاهل التغييرات وتسجيل الخروج؟',
      'تجاهل',
      true,
    );
    if (!discard) return;
  }

  setDirty(false);
  await guard(() => api.logout());
  showLogin();
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
});

async function boot(): Promise<void> {
  try {
    const session = await api.session();
    if (session.authenticated && session.user) {
      showApp(session.user);
      return;
    }
  } catch {
    // Show the login form when the session endpoint is unavailable.
  }
  showLogin();
}

void boot();
