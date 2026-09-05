const MAX_BYTES = 512 * 1024;
const ALIAS_RE = /^[a-z0-9_-]{1,40}$/;
const BACKDOOR_PREFIX = 'zenshare/';
const DEFAULT_EXPIRY_DAYS = 7;
const MAX_EXPIRY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const SHARES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    content BLOB NOT NULL,
    salt BLOB,
    iv BLOB,
    password_protected INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    is_permanent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`;
const SHARES_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at)
`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeAlias(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { error: 'alias 不能为空', code: 'alias_empty' };
  }
  let alias = raw.trim().toLowerCase();
  let backdoor = false;
  if (alias.startsWith(BACKDOOR_PREFIX)) {
    backdoor = true;
    alias = alias.slice(BACKDOOR_PREFIX.length);
  }
  if (alias === 'zenshare') {
    return { error: 'alias 已被保留', code: 'alias_invalid' };
  }
  if (!ALIAS_RE.test(alias)) {
    return {
      error: 'alias 只能包含小写字母、数字、-、_，长度 1-40',
      code: 'alias_invalid',
    };
  }
  return { alias, backdoor };
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value);
}

function cleanString(value, max, label) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return { error: `${label}格式错误` };
  const clean = value.trim();
  if (clean.length > max) return { error: `${label}不能超过 ${max} 字` };
  return clean;
}

function simplePage(status, kind, request) {
  const acceptsZh = String(
    request?.headers?.get('accept-language') || ''
  )
    .toLowerCase()
    .startsWith('zh');
  const copy =
    kind === 'notFound'
      ? acceptsZh
        ? { title: '未找到', message: '分享不存在。' }
        : { title: 'Not Found', message: 'This share does not exist.' }
      : acceptsZh
        ? { title: '已过期', message: '分享已过期。' }
        : { title: 'Gone', message: 'This share has expired.' };
  return new Response(
    `<!doctype html><html lang="${acceptsZh ? 'zh-CN' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${copy.title} · Zenshare</title><body style="font-family:system-ui,sans-serif;background:#f4f3ef;color:#1f242a;margin:0;display:grid;place-items:center;min-height:100vh"><div style="text-align:center"><h1 style="font-size:28px">${copy.title}</h1><p style="color:#6a737c">${copy.message}</p><a href="/" style="color:#0e766d">${acceptsZh ? '返回首页' : 'Back to home'}</a></div><style>@media (prefers-color-scheme: dark){body{background:#111417;color:#e7eaed}p{color:#9aa4ad}a{color:#42c6b4}}</style></body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    }
  );
}

let schemaPromise = null;
function ensureSchema(env) {
  if (!schemaPromise) {
    schemaPromise = env.DB.batch([
      env.DB.prepare(SHARES_TABLE_SQL),
      env.DB.prepare(SHARES_INDEX_SQL),
    ])
      .then(() => true)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

async function handleAliasCheck(url, env) {
  const raw = url.searchParams.get('alias') || '';
  const normalized = normalizeAlias(raw);
  if (normalized.error) {
    return json({
      available: false,
      error: normalized.error,
      code: normalized.code,
    });
  }
  await ensureSchema(env);
  const row = await env.DB.prepare('SELECT 1 FROM shares WHERE alias = ?')
    .bind(normalized.alias)
    .first();
  return json({
    available: !row,
    alias: normalized.alias,
    permanent: normalized.backdoor,
  });
}

async function handleCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误', code: 'invalid_json' }, 400);
  }

  const normalized = normalizeAlias(body.alias);
  if (normalized.error) {
    return json({ error: normalized.error }, 400);
  }

  const title = cleanString(body.title, 200, '标题');
  if (title.error) return json({ error: title.error, code: 'field_too_long' }, 400);
  const description = cleanString(body.description, 1000, '描述');
  if (description.error)
    return json({ error: description.error, code: 'field_too_long' }, 400);
  const author = cleanString(body.author, 100, '作者');
  if (author.error) return json({ error: author.error, code: 'field_too_long' }, 400);

  let tags = [];
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      return json({ error: 'tags 格式错误', code: 'tags_invalid' }, 400);
    }
    tags = body.tags
      .slice(0, 10)
      .map((tag) => String(tag).trim())
      .filter(Boolean);
    if (tags.some((tag) => tag.length > 30)) {
      return json({ error: '单个标签不能超过 30 字', code: 'tag_too_long' }, 400);
    }
  }

  if (typeof body.content !== 'string' || !body.content.trim()) {
    return json({ error: '内容不能为空', code: 'content_empty' }, 400);
  }

  let content;
  try {
    content = base64ToBytes(body.content);
  } catch {
    return json({ error: '内容编码错误', code: 'content_invalid' }, 400);
  }
  if (content.byteLength === 0) {
    return json({ error: '内容不能为空', code: 'content_empty' }, 400);
  }
  if (content.byteLength > MAX_BYTES) {
    return json(
      { error: `文件不能超过 ${MAX_BYTES / 1024}KB`, code: 'file_too_large' },
      413
    );
  }
  await ensureSchema(env);

  const passwordProtected = body.password_protected === true;
  let salt = null;
  let iv = null;
  if (passwordProtected) {
    if (typeof body.salt !== 'string' || typeof body.iv !== 'string') {
      return json({ error: '加密参数缺失', code: 'crypto_params_missing' }, 400);
    }
    try {
      salt = base64ToBytes(body.salt);
      iv = base64ToBytes(body.iv);
    } catch {
      return json({ error: '加密参数格式错误', code: 'crypto_params_invalid' }, 400);
    }
    if (salt.byteLength < 16 || iv.byteLength !== 12) {
      return json({ error: '加密参数无效', code: 'crypto_params_invalid' }, 400);
    }
  }

  let expiresAt = null;
  if (!normalized.backdoor) {
    const days =
      body.expires_days === undefined
        ? DEFAULT_EXPIRY_DAYS
        : Number(body.expires_days);
    if (!Number.isInteger(days) || days < 1 || days > MAX_EXPIRY_DAYS) {
      return json(
        {
          error: `过期天数需要在 1-${MAX_EXPIRY_DAYS} 之间`,
          code: 'expires_invalid',
        },
        400
      );
    }
    expiresAt = Date.now() + days * DAY_MS;
  }

  const createdAt = Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO shares
        (alias, title, description, author, tags, content, salt, iv, password_protected, expires_at, is_permanent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        normalized.alias,
        title,
        description,
        author,
        JSON.stringify(tags),
        content,
        salt,
        iv,
        passwordProtected ? 1 : 0,
        expiresAt,
        normalized.backdoor ? 1 : 0,
        createdAt
      )
      .run();
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return json({ error: 'alias 已被占用', code: 'alias_taken' }, 409);
    }
    throw error;
  }

  return json({
    ok: true,
    alias: normalized.alias,
    path: `/zenshare/${normalized.alias}`,
    permanent: normalized.backdoor,
    expires_at: expiresAt,
  });
}

async function handleView(request, env) {
  const url = new URL(request.url);
  const encoded = url.pathname.slice('/zenshare/'.length);
  let alias;
  try {
    alias = decodeURIComponent(encoded);
  } catch {
    return simplePage(404, 'Not Found', '分享不存在。');
  }
  const normalized = normalizeAlias(alias);
  if (normalized.error) {
    return simplePage(404, 'notFound', request);
  }
  await ensureSchema(env);

  const row = await env.DB.prepare(
    `SELECT id, alias, title, description, author, tags, content, salt, iv,
            password_protected, expires_at, is_permanent, created_at
     FROM shares WHERE alias = ?`
  )
    .bind(normalized.alias)
    .first();

  if (!row) {
    return simplePage(404, 'notFound', request);
  }

  const now = Date.now();
  if (!row.is_permanent && row.expires_at && row.expires_at <= now) {
    await env.DB.prepare('DELETE FROM shares WHERE id = ?').bind(row.id).run();
    return simplePage(410, 'gone', request);
  }

  const data = {
    alias: row.alias,
    title: row.title,
    description: row.description,
    author: row.author,
    tags: JSON.parse(row.tags || '[]'),
    passwordProtected: row.password_protected === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPermanent: row.is_permanent === 1,
    content: bytesToBase64(toBytes(row.content)),
  };
  if (row.password_protected === 1 && row.salt && row.iv) {
    data.salt = bytesToBase64(toBytes(row.salt));
    data.iv = bytesToBase64(toBytes(row.iv));
  }

  let html;
  try {
    html = await getViewTemplate(env, url);
  } catch {
    return new Response('view template missing', { status: 500 });
  }
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  html = html.replace('<!--__SHARE_DATA__-->', payload);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    },
  });
}

async function cleanupExpired(env) {
  await ensureSchema(env);
  const result = await env.DB.prepare(
    `DELETE FROM shares
     WHERE is_permanent = 0 AND expires_at IS NOT NULL AND expires_at <= ?`
  )
    .bind(Date.now())
    .run();
  return result.meta.changes || 0;
}

let viewTemplatePromise = null;
function getViewTemplate(env, url) {
  if (!viewTemplatePromise) {
    viewTemplatePromise = (async () => {
      const templateUrl = new URL('/view.html', url);
      const templateResponse = await env.ASSETS.fetch(
        new Request(templateUrl, { method: 'GET' })
      );
      if (!templateResponse.ok) {
        throw new Error('view template missing');
      }
      return templateResponse.text();
    })().catch((error) => {
      viewTemplatePromise = null;
      throw error;
    });
  }
  return viewTemplatePromise;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'GET' && pathname === '/api/alias-check') {
      return handleAliasCheck(url, env);
    }
    if (request.method === 'POST' && pathname === '/api/share') {
      return handleCreate(request, env);
    }
    if (request.method === 'GET' && pathname.startsWith('/zenshare/')) {
      return handleView(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env) {
    const removed = await cleanupExpired(env);
    console.log(`cleaned ${removed} expired shares`);
  },
};
