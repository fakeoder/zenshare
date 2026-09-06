(function () {
  const LANG_KEY = 'zenshare.lang';
  const THEME_KEY = 'zenshare.theme';
  const LANGS = ['zh', 'en'];

  const DICT = {
    zh: {
      tagline: '静态 HTML 分享',
      newShare: '新建分享',
      uploadSubtitle: '只需选择 HTML 文件；链接和所有选项都可留空',
      htmlFile: 'HTML 文件',
      pickFile: '选择 .html 文件',
      fileHint: '仅支持单个静态 .html 文件，最大 512KB',
      fileTypeError: '需要 .html 文件',
      fileTooLarge: '文件超过 {size}KB',
      contentEmpty: '内容不能为空',
      alias: 'Alias',
      customAlias: '自定义链接',
      optionalShort: '可选',
      aliasAuto: '自动生成',
      aliasAutoPlaceholder: '留空自动生成',
      aliasHint: '留空自动生成唯一链接；自定义会决定 /s/ 后面的地址',
      aliasInvalid: 'alias 只能包含小写字母、数字、-、_，长度 1-40',
      aliasChecking: '检查中…',
      aliasAvailable: '可用',
      aliasTaken: '已被占用',
      aliasCheckFailed: '检查失败',
      title: '标题',
      titlePlaceholder: '报告标题',
      author: '作者',
      authorPlaceholder: '作者',
      description: '描述',
      descriptionPlaceholder: '简短描述',
      tags: '标签',
      tagsPlaceholder: '报告, 数据, 2026',
      expiresIn: '保留时长',
      day: '{n} 天',
      dayDefault: '{n} 天（默认）',
      expiresInvalid: '保留时长需为 1 天、7 天、30 天或永久',
      neverDelete: '不删除（永久保留）',
      moreOptions: '更多选项',
      moreOptionsMeta: '全部可选 · 标题 · 作者 · 描述 · 标签 · 保留时长 · 密码',
      titleHint: '用于阅读页展示，留空默认使用文件名',
      authorHint: '展示在分享信息中',
      descriptionHint: '展示在分享信息中',
      tagsHint: '最多 10 个标签，每个不超过 30 字',
      expiresHint: '默认 7 天；选择“不删除”将永久保留',
      passwordHint: '留空不加密；设置后需要密码才能查看',
      storageFull: '空间不足，请稍后尝试',
      accessPassword: '访问密码',
      optional: '可选',
      createShare: '创建分享',
      creating: '创建中…',
      created: '已创建',
      shareLink: '分享链接',
      preview: '预览',
      previewNewWindow: '在新窗口预览',
      previewUnavailable: '没有可预览的文件，请返回首页重新选择',
      previewBlocked: '预览窗口被浏览器拦截，请允许弹窗后重试',
      copyLink: '复制链接',
      copyWithPassword: '复制带密码链接',
      openLink: '新窗口打开',
      openLinkWithPassword: '新窗口带密码打开',
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
      share: '分享',
      htmlLink: 'HTML 链接',
      snapshot: '当前快照',
      snapshotHint: '快照会保存当前页面状态：勾选、输入、展开和画布都会保留。',
      snapshotGenerating: '正在生成快照…',
      snapshotFailed: '快照生成失败，请重试',
      copyImage: '复制图片',
      copyImageFailed: '复制图片失败，请使用下载按钮',
      downloadSnapshot: '下载图片',
      regenerate: '重新截图',
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
      uploadSubtitle: 'Choose an HTML file; the link and every option can stay empty',
      htmlFile: 'HTML file',
      pickFile: 'Select .html file',
      fileHint: 'One static .html file only, up to 512KB',
      fileTypeError: 'A .html file is required',
      fileTooLarge: 'File exceeds {size}KB',
      contentEmpty: 'Content is empty',
      alias: 'Alias',
      customAlias: 'Custom link',
      optionalShort: 'Optional',
      aliasAuto: 'Auto-generated',
      aliasAutoPlaceholder: 'Leave empty to auto-generate',
      aliasHint: 'Leave empty for a unique link, or customize the /s/ path',
      aliasInvalid: 'Alias can only use lowercase letters, numbers, - and _, up to 40 chars',
      aliasChecking: 'Checking…',
      aliasAvailable: 'Available',
      aliasTaken: 'Taken',
      aliasCheckFailed: 'Check failed',
      title: 'Title',
      titlePlaceholder: 'Report title',
      author: 'Author',
      authorPlaceholder: 'Author',
      description: 'Description',
      descriptionPlaceholder: 'Short description',
      tags: 'Tags',
      tagsPlaceholder: 'report, data, 2026',
      expiresIn: 'Retention',
      day: '{n} day(s)',
      dayDefault: '{n} day(s) (default)',
      expiresInvalid: 'Retention must be 1 day, 7 days, 30 days, or permanent',
      neverDelete: 'Keep forever',
      moreOptions: 'More options',
      moreOptionsMeta: 'All optional · title · author · description · tags · retention · password',
      titleHint: 'Shown on the reader page; defaults to the file name',
      authorHint: 'Shown in share information',
      descriptionHint: 'Shown in share information',
      tagsHint: 'Up to 10 tags, each 30 characters or fewer',
      expiresHint: 'Defaults to 7 days; “Keep forever” never deletes it',
      passwordHint: 'Leave empty for no encryption; set one to require a password',
      storageFull: 'Storage is full, please try again later',
      accessPassword: 'Access password',
      optional: 'Optional',
      createShare: 'Create share',
      creating: 'Creating…',
      created: 'Created',
      shareLink: 'Share link',
      preview: 'Preview',
      previewNewWindow: 'Preview in a new window',
      previewUnavailable: 'No file is available to preview. Return home and select one.',
      previewBlocked: 'The preview window was blocked. Allow popups and try again.',
      copyLink: 'Copy link',
      copyWithPassword: 'Copy link with password',
      openLink: 'Open in new tab',
      openLinkWithPassword: 'Open with password in new tab',
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
      share: 'Share',
      htmlLink: 'HTML link',
      snapshot: 'Current snapshot',
      snapshotHint: 'The snapshot keeps the current page state, including selections, inputs, expanded sections, and canvases.',
      snapshotGenerating: 'Generating snapshot…',
      snapshotFailed: 'Snapshot failed, try again.',
      copyImage: 'Copy image',
      copyImageFailed: 'Copy failed; use download instead.',
      downloadSnapshot: 'Download image',
      regenerate: 'Regenerate',
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
