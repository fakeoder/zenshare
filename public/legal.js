(function () {
  const site = window.ZenshareSite;
  site.init();

  const CONTENT = {
    zh: {
      privacyTitle: '隐私政策',
      privacyUpdated: '更新日期：2026-09-05',
      privacySections: [
        {
          heading: '我们处理哪些数据',
          body: 'Zenshare 使用 Cloudflare Worker 和 D1 存储你上传的分享记录，包括 alias、标题、描述、作者、标签、过期时间，以及 HTML 内容。无密码分享保存原文；有密码分享只保存浏览器加密后的密文。服务端不保存访问密码。',
        },
        {
          heading: '日志与安全',
          body: 'Cloudflare 可能会按照平台默认策略保留请求日志。网站本身不使用第三方分析脚本，也不会主动读取分享内容的明文。',
        },
        {
          heading: '保留与删除',
          body: '普通分享在过期后由每日清理任务删除。永久分享会持续保留，除非根据法律要求删除，或你主动联系我们处理。',
        },
        {
          heading: '联系方式',
          body: '如需查询或删除分享，请发送邮件至 contact@zkraft.cc，我们会尽快处理。',
        },
      ],
      termsTitle: '使用条款',
      termsUpdated: '更新日期：2026-09-05',
      termsSections: [
        {
          heading: '服务描述',
          body: 'Zenshare 提供匿名静态 HTML 分享功能，仅用于分享你拥有或有权分发的静态内容。',
        },
        {
          heading: '使用限制',
          body: '禁止上传违法、恶意、侵权或包含窃取凭据等内容的文件。我们保留依法移除内容的权利。',
        },
        {
          heading: '内容责任',
          body: '上传者对分享内容负责。服务提供方不对用户上传内容承担版权或其他合法性责任。',
        },
        {
          heading: '服务状态',
          body: '服务按现状提供，不保证任何可用性。免费计划可能存在容量、请求或带宽限制。',
        },
        {
          heading: '责任限制',
          body: '在法律允许的最大范围内，服务提供方不对因使用本服务产生的间接损失承担责任。',
        },
        {
          heading: '联系方式',
          body: '如有问题，请联系 contact@zkraft.cc。',
        },
      ],
    },
    en: {
      privacyTitle: 'Privacy Policy',
      privacyUpdated: 'Last updated: September 5, 2026',
      privacySections: [
        {
          heading: 'Data we process',
          body: 'Zenshare stores share records via Cloudflare Workers and D1, including alias, title, description, author, tags, expiration time, and the HTML content. Unprotected shares store the original content; password-protected shares store only browser-encrypted ciphertext. Access passwords are never stored on the server.',
        },
        {
          heading: 'Logs and security',
          body: 'Cloudflare may retain request logs according to its platform defaults. The site uses no third-party analytics and does not actively read plaintext share content.',
        },
        {
          heading: 'Retention and deletion',
          body: 'Regular shares are deleted by a daily cleanup job after expiration. Permanent shares are retained unless removal is required by law or you contact us to intervene.',
        },
        {
          heading: 'Contact',
          body: 'To request lookup or deletion, email contact@zkraft.cc and we will respond as soon as possible.',
        },
      ],
      termsTitle: 'Terms of Use',
      termsUpdated: 'Last updated: September 5, 2026',
      termsSections: [
        {
          heading: 'Service description',
          body: 'Zenshare provides anonymous static HTML sharing for content you own or are authorized to distribute.',
        },
        {
          heading: 'Acceptable use',
          body: 'Do not upload illegal, malicious, infringing, or credential-theft content. We reserve the right to remove content where required by law.',
        },
        {
          heading: 'Content responsibility',
          body: 'Uploaders are responsible for the content they share. The service provider is not responsible for copyright or legal compliance of user uploads.',
        },
        {
          heading: 'Service status',
          body: 'The service is provided as-is without availability guarantees. Free plans may include storage, request, or bandwidth limits.',
        },
        {
          heading: 'Limitation of liability',
          body: 'To the maximum extent permitted by law, the service provider is not liable for indirect damages arising from use of the service.',
        },
        {
          heading: 'Contact',
          body: 'For questions, contact contact@zkraft.cc.',
        },
      ],
    },
  };

  function render() {
    const page = document.body.getAttribute('data-page');
    const dict = CONTENT[site.getLang()];
    const title = dict[`${page}Title`];
    document.title = `${title} · Zenshare`;
    document.getElementById('legalTitle').textContent = title;
    document.getElementById('legalUpdated').textContent = dict[`${page}Updated`];
    const container = document.getElementById('legalSections');
    container.replaceChildren();
    dict[`${page}Sections`].forEach((section) => {
      const heading = document.createElement('h2');
      heading.textContent = section.heading;
      const body = document.createElement('p');
      body.textContent = section.body;
      container.append(heading, body);
    });
  }

  document.addEventListener('zenshare:locale', render);
  render();
})();
