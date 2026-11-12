import {
  ApiError,
  api,
  clearApi,
  configureApi,
  validateConnection,
} from './api';
import {
  clearCredentials,
  createCredentials,
  loadCredentials,
  saveCredentials,
  unlockToken,
} from './credentials';
import type { StoredCredentials } from './credentials';
import { renderPageForm } from './form';
import { createImagesView } from './images';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { createMeetingsView } from './meetings';
import { createSettingsView } from './settings';
import type { PageData } from './types';
import {
  confirmDialog,
  loadingBlock,
  setBusy,
  toast,
} from './ui';

type PageTab = 'home' | 'meetingsPage' | 'site';
type Tab = 'home' | 'meetings' | 'general';
type GeneralSection = 'identity' | 'site' | 'settings';

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
    title: 'الهيدر والفوتر',
    description:
      'اسم الجمعية، القائمة، نصوص إمكانية الوصول، والفوتر.',
    preview: '/',
  },
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'meetings', label: 'اللقاءات' },
  { id: 'general', label: 'عام' },
];

const GENERAL_SECTIONS: Array<{ id: GeneralSection; label: string }> = [
  { id: 'identity', label: 'الشعار وأيقونة الموقع' },
  { id: 'site', label: 'الهيدر والفوتر' },
  { id: 'settings', label: 'بيانات التواصل' },
];

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing admin element: ${selector}`);
  return element;
}

const setupView = must<HTMLElement>('#setup-view');
const unlockView = must<HTMLElement>('#unlock-view');
const appView = must<HTMLElement>('#app-view');
const setupForm = must<HTMLFormElement>('#setup-form');
const setupUsername = must<HTMLInputElement>('#setup-username');
const setupRepo = must<HTMLInputElement>('#setup-repo');
const setupBranch = must<HTMLInputElement>('#setup-branch');
const setupToken = must<HTMLInputElement>('#setup-token');
const setupPassphrase = must<HTMLInputElement>('#setup-passphrase');
const setupPassphrase2 = must<HTMLInputElement>('#setup-passphrase2');
const setupError = must<HTMLElement>('#setup-error');
const setupSubmit = must<HTMLButtonElement>('#setup-submit');
const unlockForm = must<HTMLFormElement>('#unlock-form');
const unlockUser = must<HTMLElement>('#unlock-user');
const unlockPassphrase = must<HTMLInputElement>('#unlock-passphrase');
const unlockError = must<HTMLElement>('#unlock-error');
const unlockSubmit = must<HTMLButtonElement>('#unlock-submit');
const unlockForgot = must<HTMLButtonElement>('#unlock-forgot');
const appMain = must<HTMLElement>('#app-main');
const appTabs = must<HTMLElement>('#app-tabs');
const appSubTabs = must<HTMLElement>('#app-subtabs');
const userName = must<HTMLElement>('#user-name');
const appRepo = must<HTMLElement>('#app-repo');
const logoutButton = must<HTMLButtonElement>('#logout-button');

let stored: StoredCredentials | null = null;
let activeTab: Tab = 'home';
let generalSection: GeneralSection = 'identity';
let dirty = false;
let renderToken = 0;

function setDirty(value: boolean): void {
  dirty = value;
}

function resetNavigation(): void {
  setDirty(false);
  activeTab = 'home';
  generalSection = 'identity';
  renderToken += 1;
  appSubTabs.hidden = true;
  appMain.replaceChildren();
}

function showSetup(message?: string): void {
  resetNavigation();
  appView.hidden = true;
  unlockView.hidden = true;
  setupView.hidden = false;

  setupUsername.value = stored?.username ?? 'admin';
  setupRepo.value = stored?.repo ?? 'eramax/Den-Glada-Familjen';
  setupBranch.value = stored?.branch ?? 'main';
  setupToken.value = '';
  setupPassphrase.value = '';
  setupPassphrase2.value = '';

  setupError.textContent = message ?? '';
  setupError.hidden = !message;
  setupUsername.focus();
}

function showUnlock(message?: string): void {
  resetNavigation();
  setupView.hidden = true;
  appView.hidden = true;
  unlockView.hidden = false;

  unlockUser.textContent = stored?.username ?? 'admin';
  unlockError.textContent = message ?? '';
  unlockError.hidden = !message;
  unlockPassphrase.value = '';
  unlockPassphrase.focus();
}

function showApp(): void {
  setDirty(false);
  setupView.hidden = true;
  unlockView.hidden = true;
  appView.hidden = false;
  userName.textContent = stored?.username ?? 'admin';
  appRepo.textContent = stored
    ? `${stored.repo} · ${stored.branch}`
    : '';

  renderTabs();
  appSubTabs.hidden = true;
  void activate('home');
}

function handleAuthError(
  message = 'التوكن غير صالح أو منتهي. أعد المحاولة أو أعد الإعداد.',
): void {
  clearApi();
  showUnlock(message);
}

async function guard<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      handleAuthError();
      return null;
    }
    toast(
      error instanceof Error ? error.message : 'حدث خطأ غير متوقع.',
      { type: 'error' },
    );
    return null;
  }
}

async function confirmDiscard(): Promise<boolean> {
  if (!dirty) return true;
  const discard = await confirmDialog(
    'تغييرات غير محفوظة',
    'هل تريد تجاهل التغييرات والانتقال؟',
    'تجاهل',
    true,
  );
  if (!discard) return false;
  setDirty(false);
  return true;
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

function renderGeneralSubTabs(): void {
  appSubTabs.replaceChildren();
  for (const section of GENERAL_SECTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app__subtab';
    button.dataset.section = section.id;
    button.textContent = section.label;
    button.addEventListener('click', () => {
      void activateGeneralSection(section.id);
    });
    appSubTabs.append(button);
  }
  updateGeneralSubTabs();
}

function updateGeneralSubTabs(): void {
  appSubTabs
    .querySelectorAll<HTMLButtonElement>('.app__subtab')
    .forEach((button) => {
      const isActive = button.dataset.section === generalSection;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
}

async function activate(tab: Tab): Promise<void> {
  if (tab === activeTab && appMain.childElementCount > 0) return;
  if (!(await confirmDiscard())) return;

  activeTab = tab;
  updateTabs();
  appMain.replaceChildren();
  appSubTabs.hidden = tab !== 'general';

  if (tab === 'general') {
    renderGeneralSubTabs();
    await activateGeneralSection(generalSection);
    return;
  }

  if (tab === 'meetings') {
    await renderMeetingsTab();
    return;
  }

  await renderPage(tab);
}

async function activateGeneralSection(section: GeneralSection): Promise<void> {
  if (
    section === generalSection &&
    activeTab === 'general' &&
    appMain.childElementCount > 0
  ) {
    return;
  }
  if (!(await confirmDiscard())) return;

  generalSection = section;
  appSubTabs.hidden = false;
  updateGeneralSubTabs();
  appMain.replaceChildren();

  if (section === 'identity') {
    const view = createImagesView({
      container: appMain,
      onAuthError: () => handleAuthError(),
    });
    await view.load();
    return;
  }

  if (section === 'settings') {
    const view = createSettingsView({
      container: appMain,
      setDirty,
      onAuthError: () => handleAuthError(),
    });
    await view.load();
    return;
  }

  await renderPage('site');
}

async function renderMeetingsTab(): Promise<void> {
  appMain.replaceChildren();

  let meetingsDirty = false;
  let pageTextDirty = false;
  const updateDirty = () => setDirty(meetingsDirty || pageTextDirty);

  const listPanel = document.createElement('div');
  appMain.append(listPanel);

  const view = createMeetingsView({
    container: listPanel,
    setDirty: (value) => {
      meetingsDirty = value;
      updateDirty();
    },
    confirm: confirmDialog,
    onAuthError: () => handleAuthError(),
  });
  await view.load();

  const details = document.createElement('details');
  details.className = 'meetings-page-text';

  const summary = document.createElement('summary');
  summary.className = 'meetings-page-text__summary';
  const summaryText = document.createElement('span');
  summaryText.textContent =
    'نصوص صفحة اللقاءات — الموعد، المكان، الأرشيف';
  summary.append(summaryText);

  const body = document.createElement('div');
  body.className = 'meetings-page-text__body';

  details.append(summary, body);
  appMain.append(details);

  await renderMeetingsPageText(body, (value) => {
    pageTextDirty = value;
    updateDirty();
  });
}

async function renderMeetingsPageText(
  container: HTMLElement,
  onDirty: (dirty: boolean) => void,
): Promise<void> {
  const definition = PAGES.meetingsPage;
  container.replaceChildren(loadingBlock('جارٍ تحميل نصوص صفحة اللقاءات...'));

  const response = await guard(() => api.getContent(definition.path));
  if (!response) {
    container.replaceChildren();
    return;
  }

  let parsed: ReturnType<typeof parseMarkdown<PageData>>;
  try {
    parsed = parseMarkdown<PageData>(response.text);
  } catch (error) {
    container.replaceChildren();
    toast(
      error instanceof Error ? error.message : 'تعذّر قراءة الملف.',
      { type: 'error' },
    );
    return;
  }

  const page = {
    path: definition.path,
    sha: response.sha,
    data: parsed.data,
    body: parsed.body,
  };

  container.replaceChildren();

  const intro = document.createElement('div');
  intro.className = 'meetings-page-text__intro';

  const description = document.createElement('p');
  description.textContent =
    'عدّل الموعد، المكان، بطاقات التنسيق، ونصوص الأرشيف. تُحفظ التغييرات في صفحة اللقاءات.';

  const preview = document.createElement('a');
  preview.className = 'btn btn--small btn--ghost';
  preview.href = definition.preview;
  preview.target = '_blank';
  preview.rel = 'noopener noreferrer';
  preview.textContent = 'معاينة صفحة اللقاءات';

  intro.append(description, preview);

  const formContainer = document.createElement('div');
  formContainer.className = 'editor-form';

  const bar = document.createElement('div');
  bar.className = 'admin-savebar admin-savebar--inline';

  const status = document.createElement('span');
  status.className = 'admin-savebar__status';
  status.textContent = 'كل التغييرات محفوظة';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn btn--primary';
  save.textContent = 'حفظ نصوص الصفحة';

  const markDirty = () => {
    onDirty(true);
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
      onDirty(false);
      status.textContent = 'تم الحفظ — سيظهر الموقع خلال 1–2 دقيقة.';
      status.classList.remove('is-dirty');
      toast('تم حفظ نصوص صفحة اللقاءات.', {
        link: saved.commitUrl,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleAuthError();
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
  container.append(intro, formContainer, bar);
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
        handleAuthError();
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

setupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = setupUsername.value.trim() || 'admin';
  const repo = setupRepo.value.trim();
  const branch = setupBranch.value.trim() || 'main';
  const token = setupToken.value.trim();
  const passphrase = setupPassphrase.value;
  const confirmation = setupPassphrase2.value;

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    setupError.textContent = 'صيغة المستودع يجب أن تكون owner/repo.';
    setupError.hidden = false;
    return;
  }
  if (!token) {
    setupError.textContent = 'أدخل GitHub Token.';
    setupError.hidden = false;
    return;
  }
  if (passphrase.length < 10) {
    setupError.textContent = 'عبارة المرور يجب أن تكون 10 أحرف على الأقل.';
    setupError.hidden = false;
    return;
  }
  if (passphrase !== confirmation) {
    setupError.textContent = 'عبارتا المرور غير متطابقتين.';
    setupError.hidden = false;
    return;
  }

  setupError.hidden = true;
  setBusy(setupSubmit, true, 'جارٍ اختبار الاتصال...');

  try {
    configureApi({ token, repo, branch });
    await validateConnection();

    const credentials = await createCredentials({
      username,
      repo,
      branch,
      token,
      passphrase,
    });
    saveCredentials(credentials);
    stored = credentials;

    setupToken.value = '';
    setupPassphrase.value = '';
    setupPassphrase2.value = '';
    showApp();
  } catch (error) {
    clearApi();
    setupError.textContent =
      error instanceof Error ? error.message : 'تعذّر الاتصال بـ GitHub.';
    setupError.hidden = false;
  } finally {
    setBusy(setupSubmit, false);
  }
});

unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!stored) {
    showSetup();
    return;
  }

  const passphrase = unlockPassphrase.value;
  if (!passphrase) {
    unlockError.textContent = 'أدخل عبارة المرور.';
    unlockError.hidden = false;
    return;
  }

  unlockError.hidden = true;
  setBusy(unlockSubmit, true, 'جارٍ الفتح...');

  try {
    const token = await unlockToken(stored, passphrase);
    configureApi({ token, repo: stored.repo, branch: stored.branch });
    await validateConnection();
    unlockPassphrase.value = '';
    showApp();
  } catch (error) {
    clearApi();
    unlockError.textContent =
      error instanceof Error ? error.message : 'تعذّر فتح اللوحة.';
    unlockError.hidden = false;
    unlockPassphrase.select();
  } finally {
    setBusy(unlockSubmit, false);
  }
});

unlockForgot.addEventListener('click', async () => {
  const confirmed = await confirmDialog(
    'إعادة الإعداد',
    'سيتم حذف التوكن المشفّر وعبارة المرور من هذا المتصفح. ستحتاج إلى إدخال التوكن من جديد.',
    'حذف الإعداد',
    true,
  );
  if (!confirmed) return;

  clearApi();
  clearCredentials();
  stored = null;
  showSetup();
});

logoutButton.addEventListener('click', async () => {
  if (dirty) {
    const discard = await confirmDialog(
      'تغييرات غير محفوظة',
      'هل تريد تجاهل التغييرات وقفل اللوحة؟',
      'تجاهل',
      true,
    );
    if (!discard) return;
  }

  setDirty(false);
  clearApi();
  if (stored) showUnlock();
  else showSetup();
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
});

stored = loadCredentials();
if (stored) showUnlock();
else showSetup();
