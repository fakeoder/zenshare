(function () {
  const LANG_KEY = 'zenshare.lang';
  const THEME_KEY = 'zenshare.theme';
  const LANGS = ['zh', 'en'];

  const DICT = {
    zh: {
      tagline: '静态 HTML 分享',
      newShare: '新建分享',
      htmlFile: 'HTML 文件',
      pickFile: '选择 .html 文件',
      fileTypeError: '需要 .html 文件',
      fileTooLarge: '文件超过 {size}KB',
      contentEmpty: '内容不能为空',
      alias: 'Alias',
      aliasHint: '小写字母、数字、-、_，1-40 位',
      aliasEmpty: 'alias 不能为空',
      aliasInvalid: 'alias 只能包含小写字母、数字、-、_，长度 1-40',
      aliasChecking: '检查中…',
      aliasAvailable: '可用',
      aliasTaken: '已被占用',
      aliasCheckFailed: '检查失败',
      aliasPermanentAvailable: '永久可用',
      title: '标题',
      titlePlaceholder: '报告标题',
      author: '作者',
      authorPlaceholder: '作者',
      description: '描述',
      descriptionPlaceholder: '简短描述',
      tags: '标签',
      tagsPlaceholder: '报告, 数据, 2026',
      expiresIn: '过期时间',
      day: '{n} 天',
      dayDefault: '{n} 天（默认）',
      expiresInvalid: '过期天数需要在 1-30 之间',
      accessPassword: '访问密码',
      optional: '可选',
      createShare: '创建分享',
      creating: '创建中…',
      created: '已创建',
      shareLink: '分享链接',
      copyLink: '复制链接',
      copied: '已复制',
      selectFile: '请选择 HTML 文件',
      requestError: '请求失败，请稍后重试',
      createFailed: '创建失败',
      passwordProtected: '受密码保护',
      unlock: '解锁',
      passwordPlaceholder: '访问密码',
      passwordError: '密码错误或文件已损坏',
      info: '查看信息',
      downloadHtml: '下载 HTML',
      exportPdf: '导出 PDF',
      authorMeta: '作者',
      descriptionMeta: '描述',
      tagsMeta: '标签',
      linkMeta: '链接',
      createdMeta: '创建于',
      expiresMeta: '过期',
      permanent: '永久',
      backHome: '返回首页',
      privacy: '隐私政策',
      terms: '使用条款',
      products: '更多产品',
      contact: '联系我们',
      license: 'License',
      openSource: '开源地址',
      copyright: '保留所有权利',
      toggleTheme: '切换深浅色',
      switchLanguage: '切换语言',
      sharedBy: '由 Zenshare 分享',
      close: '关闭',
      fieldTooLong: '内容超过长度限制',
      tagTooLong: '单个标签不能超过 30 字',
      tagsInvalid: '标签格式错误',
    },
    en: {
      tagline: 'Static HTML sharing',
      newShare: 'New share',
      htmlFile: 'HTML file',
      pickFile: 'Select .html file',
      fileTypeError: 'A .html file is required',
      fileTooLarge: 'File exceeds {size}KB',
      contentEmpty: 'Content is empty',
      alias: 'Alias',
      aliasHint: 'Lowercase letters, numbers, - and _, 1-40 chars',
      aliasEmpty: 'Alias is required',
      aliasInvalid: 'Alias can only use lowercase letters, numbers, - and _, up to 40 chars',
      aliasChecking: 'Checking…',
      aliasAvailable: 'Available',
      aliasTaken: 'Taken',
      aliasCheckFailed: 'Check failed',
      aliasPermanentAvailable: 'Permanent · Available',
      title: 'Title',
      titlePlaceholder: 'Report title',
      author: 'Author',
      authorPlaceholder: 'Author',
      description: 'Description',
      descriptionPlaceholder: 'Short description',
      tags: 'Tags',
      tagsPlaceholder: 'report, data, 2026',
      expiresIn: 'Expires in',
      day: '{n} day(s)',
      dayDefault: '{n} day(s) (default)',
      expiresInvalid: 'Expiry must be between 1 and 30 days',
      accessPassword: 'Access password',
      optional: 'Optional',
      createShare: 'Create share',
      creating: 'Creating…',
      created: 'Created',
      shareLink: 'Share link',
      copyLink: 'Copy link',
      copied: 'Copied',
      selectFile: 'Select an HTML file',
      requestError: 'Request failed, please try again',
      createFailed: 'Failed to create share',
      passwordProtected: 'Password protected',
      unlock: 'Unlock',
      passwordPlaceholder: 'Access password',
      passwordError: 'Incorrect password or corrupted file',
      info: 'Info',
      downloadHtml: 'Download HTML',
      exportPdf: 'Export PDF',
      authorMeta: 'Author',
      descriptionMeta: 'Description',
      tagsMeta: 'Tags',
      linkMeta: 'Link',
      createdMeta: 'Created',
      expiresMeta: 'Expires',
      permanent: 'Permanent',
      backHome: 'Back to home',
      privacy: 'Privacy',
      terms: 'Terms',
      products: 'Products',
      contact: 'Contact',
      license: 'License',
      openSource: 'Open Source',
      copyright: 'All rights reserved',
      toggleTheme: 'Toggle dark mode',
      switchLanguage: 'Switch language',
      sharedBy: 'Shared with Zenshare',
      close: 'Close',
      fieldTooLong: 'Field exceeds the length limit',
      tagTooLong: 'Each tag must be 30 characters or fewer',
      tagsInvalid: 'Invalid tags format',
    },
  };

  let lang = localStorage.getItem(LANG_KEY) || 'en';
  const browserLang = String(navigator.language || '').toLowerCase();
  if (!LANGS.includes(lang)) {
    lang = browserLang.startsWith('zh') ? 'zh' : 'en';
  }

  let theme = localStorage.getItem(THEME_KEY);
  if (theme !== 'light' && theme !== 'dark') {
    theme =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  }

  function t(key, vars) {
    let text = DICT[lang][key];
    if (text === undefined) return key;
    if (vars) {
      Object.entries(vars).forEach(([name, value]) => {
        text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      });
    }
    return text;
  }

  function translate(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (DICT[lang][key] !== undefined) el.textContent = DICT[lang][key];
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (DICT[lang][key] !== undefined) el.placeholder = DICT[lang][key];
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (DICT[lang][key] !== undefined) el.title = DICT[lang][key];
    });
  }

  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = lang;
    document.querySelectorAll('[data-set-lang]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-set-lang') === lang);
    });
    translate(document);
    document.dispatchEvent(
      new CustomEvent('zenshare:locale', { detail: { lang } })
    );
  }

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    document
      .querySelectorAll('[data-action="theme"]')
      .forEach((btn) => btn.setAttribute('aria-label', t('toggleTheme')));
  }

  function setLang(next) {
    if (!LANGS.includes(next)) return;
    lang = next;
    localStorage.setItem(LANG_KEY, lang);
    applyLang();
  }

  function setTheme(next) {
    theme = next;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme();
  }

  function init() {
    document
      .querySelectorAll('[data-action="theme"]')
      .forEach((btn) =>
        btn.addEventListener('click', () =>
          setTheme(theme === 'dark' ? 'light' : 'dark')
        )
      );
    document
      .querySelectorAll('[data-action="lang"]')
      .forEach((btn) =>
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-set-lang');
          setLang(target || (lang === 'zh' ? 'en' : 'zh'));
        })
      );
    applyTheme();
    applyLang();
  }

  window.ZenshareSite = {
    getLang: () => lang,
    setLang,
    getTheme: () => theme,
    setTheme,
    t,
    init,
  };
})();
