(function () {
  const LANG_KEY = 'zenshare.lang';
  const THEME_KEY = 'zenshare.theme';
  const LANGS = ['zh', 'en'];

  const DICT = {
    zh: {
      tagline: '静态文件分享',
      newShare: '新建分享',
      uploadSubtitle: '选择一个文本文件；链接和所有选项都可留空',
      shareFile: '文件',
      htmlFile: '文件',
      pickFile: '选择文件',
      fileHint: '支持 HTML、ICS、CSV、JSON、MD、TXT、XML、YAML，单个文件最大 512KB',
      fileTypeError: '不支持的文件类型',
      contentInvalid: '文件内容无效',
      createIcsTool: '没有 ICS 文件？去创建',
      fileTypeMeta: '类型',
      fileTooLarge: '文件超过 {size}KB',
      contentEmpty: '内容不能为空',
      alias: 'Alias',
      customAlias: '自定义链接',
      optionalShort: '可选',
      aliasAuto: '自动',
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
      moreOptionsMeta: '全部可选 · 自定义链接 · 标题 · 作者 · 描述 · 标签',
      titleHint: '用于阅读页展示，留空默认使用文件名',
      authorHint: '展示在分享信息中',
      descriptionHint: '展示在分享信息中',
      tagsHint: '最多 10 个标签，每个不超过 30 字',
      expiresHint: '默认 7 天；选择“不删除”将永久保留',
      passwordHint: '留空不加密；设置后需要密码才能查看',
      visibility: '访问范围',
      visibilityRetention: '访问范围与保留时长',
      visibilityPublic: '公开',
      visibilityPrivate: '私密',
      visibilityPublicHint: '公开分享会出现在公开目录，所有人都可以查看和搜索',
      visibilityPrivateHint: '私密分享不会出现在公开目录',
      passwordRequired: '默认自动生成强密码，也可手动修改；服务端只保存密文，启用管理令牌时另存一份仅令牌可解封的密码副本',
      regeneratePassword: '重新生成强密码',
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
      copyPassword: '复制密码',
      copyDecryptLink: '复制解密链接',
      passwordNotRecoverable: '该分享没有可恢复的密码（创建时未启用管理令牌）',
      openLink: '新窗口打开',
      openLinkWithPassword: '新窗口带密码打开',
      copied: '已复制',
      selectFile: '请选择文件',
      requestError: '请求失败，请稍后重试',
      createFailed: '创建失败',
      passwordProtected: '受密码保护',
      unlock: '解锁',
      passwordPlaceholder: '访问密码',
      passwordError: '密码错误或文件已损坏',
      info: '查看信息',
      downloadHtml: '下载文件',
      downloadFile: '下载文件',
      copyRawLink: '复制 Raw 链接',
      rawLink: 'Raw 链接',
      rawLinkCopied: 'Raw 链接已复制',
      rawLinkCopiedIcs: 'Raw 链接已复制，可作为日历订阅 URL',
      share: '分享',
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
      statusTitle: '服务状态',
      statusHealthy: '健康',
      statusWarning: '警告',
      statusError: '异常',
      statusLoading: '加载中…',
      statusUnavailable: '状态获取失败，请稍后重试',
      statusUpdated: '更新于',
      statusCapacity: '容量',
      statusUsed: '已用',
      statusRemaining: '剩余',
      statusDetailHealthy: '服务正常，容量充足。',
      statusDetailWarning: '容量接近上限，请及时清理。',
      statusDetailError: '容量已满或服务暂不可用，暂时无法新建分享。',
      moreActions: '更多操作',
      publicShares: '公开分享',
      browseTitle: '公开分享',
      browseSubtitle: '浏览未加密且未过期的分享',
      searchPlaceholder: '搜索标题、作者、标签…',
      searching: '搜索中…',
      resultCount: '共 {total} 个分享',
      pageInfo: '第 {page} / {totalPages} 页',
      previousPage: '上一页',
      nextPage: '下一页',
      noResults: '没有找到匹配的分享',
      browseFailed: '加载失败，请稍后重试',
      untitled: '无标题',
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
      myShares: '我的分享',
      mySharesSubtitle: '管理你创建的分享（需要先加载 Token）',
      manageableLabel: '可管理此分享',
      manageableHint: '启用后可随时修改、更新和删除此分享；首次启用时会自动要求创建或导入 Token',
      tokenWarn: '请妥善保管 token 文件，它是管理分享的唯一凭证，丢失后无法找回',
      tokenGenerate: '生成 Token',
      tokenConfirm: '确认',
      tokenUpload: '导入 Token 文件',
      tokenSwitch: '导入',
      tokenRemove: '移除',
      tokenLoaded: '已加载 · {short}',
      tokenLoadedLabel: '已加载 · {label}',
      tokenMissing: '未加载 Token',
      tokenInvalid: 'Token 文件无效',
      tokenPromptText: '管理分享需要先创建或导入 Token',
      tokenSetup: '创建 / 导入 Token',
      tokenSelectFile: '选择 Token 文件',
      tokenRequired: '请先在右上角加载或生成 Token',
      tokenLabelPrompt: '给 Token 起个名字方便识别（可选，留空跳过，取消放弃生成）',
      tokenLabelPlaceholder: '标签',
      tokenLabel: '名称',
      manageToken: '管理 Token',
      copyToken: '复制 Token',
      tokenDownload: '下载 Token 文件',
      tokenGenerateConfirm:
        '请先保存好当前 Token 文件，否则旧 Token 管理的分享将无法再管理。确定继续吗？',
      tokenImportConfirm: '导入新 Token 将替换当前 Token，确定继续吗？',
      tokenClearConfirm: '请先保存好 Token 文件，否则该 Token 管理的分享将无法再管理。确定移除吗？',
      tokenFileImportant: 'Token 文件是你管理分享的唯一方式，请妥善备份',
      tokenManageHint: '在此管理你的 Token：复制、下载、更换或移除',
      tokenNoTokenHint: '还没有加载 Token，生成一个新的或导入已有的 Token 文件',
      tokenDetails: '详细信息',
      tokenCreatedAt: '创建时间',
      cancel: '取消',
      saveChanges: '保存修改',
      saving: '保存中…',
      editShare: '编辑分享',
      editFailed: '更新失败',
      editFileHint:
        '不选择文件只更新基本信息和访问密码；选择文件会替换原有内容',
      editRequiresFile: '更改加密状态需要重新选择文件',
      editPasswordHint: '内容将使用此密码加密',
      editPasswordKeepHint: '留空则保持原密码不变',
      newPassword: '新密码',
      editDecryptFailed: '无法用管理 token 解密当前内容，请确认本地 token 与该分享匹配',
      editContentLoadFailed: '获取当前内容失败',
      deleteShare: '删除',
      deleteConfirm: '确定删除这个分享吗？删除后无法恢复。',
      deleteFailed: '删除失败',
      keepExpiry: '保持当前设置',
      encrypted: '已加密',
      manageTabEmpty: '这个 Token 下还没有分享',
    },
    en: {
      tagline: 'Static file sharing',
      newShare: 'New share',
      uploadSubtitle: 'Choose a text file; the link and every option can stay empty',
      shareFile: 'File',
      htmlFile: 'File',
      pickFile: 'Select a file',
      fileHint: 'HTML, ICS, CSV, JSON, MD, TXT, XML, YAML supported, up to 512KB each',
      fileTypeError: 'Unsupported file type',
      contentInvalid: 'Invalid file content',
      createIcsTool: 'No ICS file? Create one',
      fileTypeMeta: 'Type',
      fileTooLarge: 'File exceeds {size}KB',
      contentEmpty: 'Content is empty',
      alias: 'Alias',
      customAlias: 'Custom link',
      optionalShort: 'Optional',
      aliasAuto: 'Auto',
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
      moreOptionsMeta: 'All optional · custom link · title · author · description · tags',
      titleHint: 'Shown on the reader page; defaults to the file name',
      authorHint: 'Shown in share information',
      descriptionHint: 'Shown in share information',
      tagsHint: 'Up to 10 tags, each 30 characters or fewer',
      expiresHint: 'Defaults to 7 days; “Keep forever” never deletes it',
      passwordHint: 'Leave empty for no encryption; set one to require a password',
      visibility: 'Visibility',
      visibilityRetention: 'Visibility & retention',
      visibilityPublic: 'Public',
      visibilityPrivate: 'Private',
      visibilityPublicHint: 'Public shares appear in the public directory; everyone can view and search them',
      visibilityPrivateHint: 'Private shares stay out of the public directory',
      passwordRequired: 'A strong password is generated by default; you can edit or regenerate it. The server only stores ciphertext — with a manage token it also keeps a copy sealed to that token',
      regeneratePassword: 'Regenerate strong password',
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
      copyPassword: 'Copy password',
      copyDecryptLink: 'Copy decrypt link',
      passwordNotRecoverable:
        'No recoverable password for this share (created without a manage token)',
      openLink: 'Open in new tab',
      openLinkWithPassword: 'Open with password in new tab',
      copied: 'Copied',
      selectFile: 'Select a file',
      requestError: 'Request failed, please try again',
      createFailed: 'Failed to create share',
      passwordProtected: 'Password protected',
      unlock: 'Unlock',
      passwordPlaceholder: 'Access password',
      passwordError: 'Incorrect password or corrupted file',
      info: 'Info',
      downloadHtml: 'Download file',
      downloadFile: 'Download file',
      copyRawLink: 'Copy raw link',
      rawLink: 'Raw link',
      rawLinkCopied: 'Raw link copied',
      rawLinkCopiedIcs: 'Raw link copied — use it as a calendar subscription URL',
      share: 'Share',
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
      statusTitle: 'Service Status',
      statusHealthy: 'Healthy',
      statusWarning: 'Warning',
      statusError: 'Error',
      statusLoading: 'Loading…',
      statusUnavailable: 'Failed to load status. Please try again later.',
      statusUpdated: 'Updated at',
      statusCapacity: 'Capacity',
      statusUsed: 'Used',
      statusRemaining: 'Remaining',
      statusDetailHealthy: 'Service is healthy and capacity is available.',
      statusDetailWarning: 'Capacity is close to the limit; clean up soon.',
      statusDetailError: 'Capacity is full or the service is unavailable.',
      moreActions: 'More actions',
      publicShares: 'Public shares',
      browseTitle: 'Public shares',
      browseSubtitle: 'Browse unencrypted, unexpired shares',
      searchPlaceholder: 'Search title, author, tags…',
      searching: 'Searching…',
      resultCount: '{total} shares',
      pageInfo: 'Page {page} of {totalPages}',
      previousPage: 'Previous',
      nextPage: 'Next',
      noResults: 'No matching shares',
      browseFailed: 'Failed to load, please try again',
      untitled: 'Untitled',
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
      myShares: 'My shares',
      mySharesSubtitle: 'Manage the shares you created (token required)',
      manageableLabel: 'Make share manageable',
      manageableHint:
        'Edit, update and delete later from My Shares; a token will be required on first use',
      tokenWarn:
        'Keep your token file safe — it is the only way to manage your shares. Losing it means losing access forever.',
      tokenGenerate: 'Generate token',
      tokenConfirm: 'Confirm',
      tokenUpload: 'Import token file',
      tokenSwitch: 'Import',
      tokenRemove: 'Remove',
      tokenLoaded: 'Loaded · {short}',
      tokenLoadedLabel: 'Loaded · {label}',
      tokenMissing: 'No token loaded',
      tokenInvalid: 'Invalid token file',
      tokenPromptText: 'You need a token to manage your shares',
      tokenSetup: 'Create / Import Token',
      tokenSelectFile: 'Select token file',
      tokenRequired: 'Load or generate a token first (top-right key icon)',
      tokenLabelPrompt:
        'Give this token a name for easy identification (optional, leave empty to skip, cancel to abort)',
      tokenLabelPlaceholder: 'Label',
      tokenLabel: 'Name',
      manageToken: 'Manage token',
      copyToken: 'Copy token',
      tokenDownload: 'Download token file',
      tokenGenerateConfirm:
        'Please save your current token file first — shares bound to it will become unmanageable. Continue?',
      tokenImportConfirm: 'Importing a new token will replace the current one. Continue?',
      tokenClearConfirm:
        'Please save your token file first — shares bound to it will become unmanageable. Remove?',
      tokenFileImportant: 'Your token file is the only way to manage shares — keep a backup',
      tokenManageHint: 'Manage your token here: copy, download, switch, or remove',
      tokenNoTokenHint: 'No token loaded yet. Generate a new one or import an existing token file.',
      tokenDetails: 'Details',
      tokenCreatedAt: 'Created',
      cancel: 'Cancel',
      saveChanges: 'Save changes',
      saving: 'Saving…',
      editShare: 'Edit share',
      editFailed: 'Update failed',
      editFileHint:
        'Without a new file only basic info and the access password are updated; picking a file replaces the content',
      editRequiresFile: 'Changing encryption requires re-selecting the file',
      editPasswordHint: 'The content will be encrypted with this password',
      editPasswordKeepHint: 'Leave empty to keep the current password',
      newPassword: 'New password',
      editDecryptFailed:
        'Could not decrypt the current content with your manage token — check that the local token matches this share',
      editContentLoadFailed: 'Failed to load the current content',
      deleteShare: 'Delete',
      deleteConfirm: 'Delete this share? This cannot be undone.',
      deleteFailed: 'Delete failed',
      keepExpiry: 'Keep current',
      encrypted: 'Encrypted',
      manageTabEmpty: 'No shares under this token yet',
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
    scope.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (DICT[lang][key] !== undefined) el.setAttribute('aria-label', DICT[lang][key]);
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
