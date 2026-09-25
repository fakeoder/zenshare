const MAX_BYTES = 512 * 1024;
const ALIAS_RE = /^[a-z0-9_-]{1,40}$/;
const DEFAULT_EXPIRY_DAYS = 7;
const MAX_SHARES = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FILE_TYPES = {
  html: { exts: ['html', 'htm', 'xhtml'], mime: 'text/html' },
  ics: { exts: ['ics'], mime: 'text/calendar' },
  csv: { exts: ['csv'], mime: 'text/csv' },
  json: { exts: ['json'], mime: 'application/json' },
  md: { exts: ['md', 'markdown'], mime: 'text/markdown' },
  txt: { exts: ['txt', 'log'], mime: 'text/plain' },
  xml: { exts: ['xml'], mime: 'application/xml' },
  yaml: { exts: ['yaml', 'yml'], mime: 'text/yaml' },
};
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
    created_at INTEGER NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'html',
    filename TEXT NOT NULL DEFAULT '',
    manage_token_hash TEXT
  )
`;
const SHARES_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at)
`;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

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
  if (raw === undefined || raw === null) {
    return { alias: '', generated: true };
  }
  if (typeof raw !== 'string') {
    return { error: 'alias 格式错误', code: 'alias_invalid' };
  }
  const alias = raw.trim().toLowerCase();
  if (!alias) return { alias: '', generated: true };
  if (alias === 'zenshare') {
    return { error: 'alias 已被保留', code: 'alias_invalid' };
  }
  if (!ALIAS_RE.test(alias)) {
    return {
      error: 'alias 只能包含小写字母、数字、-、_，长度 1-40',
      code: 'alias_invalid',
    };
  }
  return { alias };
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

function isStrongToken(token) {
  if (!TOKEN_RE.test(token)) return false;
  return new Set(token).size >= 16;
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  return bytesToBase64(new Uint8Array(digest));
}

function readManageToken(request) {
  const header = String(request.headers.get('authorization') || '').trim();
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : '';
}

async function manageTokenHash(request) {
  const token = readManageToken(request);
  if (!isStrongToken(token)) return null;
  return hashToken(token);
}

function cleanString(value, max, label) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return { error: `${label}格式错误` };
  const clean = value.trim();
  if (clean.length > max) return { error: `${label}不能超过 ${max} 字` };
  return clean;
}

function parseTags(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeFileType(raw) {
  const value = String(raw || 'html').trim().toLowerCase();
  return FILE_TYPES[value] ? value : 'html';
}

function cleanFilename(raw) {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') return { error: '文件名格式错误' };
  const clean = raw.trim().replace(/[\\/]/g, '_').slice(0, 255);
  return clean;
}

function sniffText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
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
    schemaPromise = (async () => {
      await env.DB.batch([
        env.DB.prepare(SHARES_TABLE_SQL),
        env.DB.prepare(SHARES_INDEX_SQL),
      ]);
      const info = await env.DB.prepare('PRAGMA table_info(shares)').all();
      const columns = new Set(
        (info.results || []).map((row) => String(row.name))
      );
      const alters = [];
      if (!columns.has('file_type')) {
        alters.push(
          env.DB.prepare(
            "ALTER TABLE shares ADD COLUMN file_type TEXT NOT NULL DEFAULT 'html'"
          )
        );
      }
      if (!columns.has('filename')) {
        alters.push(
          env.DB.prepare(
            "ALTER TABLE shares ADD COLUMN filename TEXT NOT NULL DEFAULT ''"
          )
        );
      }
      if (!columns.has('manage_token_hash')) {
        alters.push(
          env.DB.prepare(
            'ALTER TABLE shares ADD COLUMN manage_token_hash TEXT'
          )
        );
      }
      if (alters.length) await env.DB.batch(alters);
      await env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(manage_token_hash)'
      ).run();
      return true;
    })().catch((error) => {
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
  if (normalized.generated) {
    return json({ available: true, alias: '', generated: true });
  }
  await ensureSchema(env);
  const row = await env.DB.prepare('SELECT 1 FROM shares WHERE alias = ?')
    .bind(normalized.alias)
    .first();
  return json({
    available: !row,
    alias: normalized.alias,
    permanent: false,
  });
}

function statusForUsage(percent) {
  if (percent >= 99) return 'error';
  if (percent >= 80) return 'warning';
  return 'healthy';
}

async function handleStatus(env) {
  try {
    await ensureSchema(env);
    const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM shares')
      .first();
    const used = row ? Number(row.count) : 0;
    const max = MAX_SHARES;
    const percent = max > 0 ? (used / max) * 100 : 0;
    return json({
      ok: true,
      status: statusForUsage(percent),
      max,
      used,
      remaining: Math.max(0, max - used),
      percent: Math.round(percent * 10) / 10,
      checkedAt: Date.now(),
    });
  } catch {
    return json({ ok: false, status: 'error', checkedAt: Date.now() }, 503);
  }
}

function validateMeta(body) {
  const fields = [
    ['title', 200, '标题'],
    ['description', 1000, '描述'],
    ['author', 100, '作者'],
  ];
  const meta = {};
  for (const [key, max, label] of fields) {
    if (body[key] === undefined) continue;
    const value = cleanString(body[key], max, label);
    if (value.error) return { error: value.error, code: 'field_too_long' };
    meta[key] = value;
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      return { error: 'tags 格式错误', code: 'tags_invalid' };
    }
    const tags = body.tags
      .slice(0, 10)
      .map((tag) => String(tag).trim())
      .filter(Boolean);
    if (tags.some((tag) => tag.length > 30)) {
      return { error: '单个标签不能超过 30 字', code: 'tag_too_long' };
    }
    meta.tags = tags;
  }
  return { meta };
}

function parseExpires(body) {
  const isPermanent = body.expires_days === null;
  let expiresAt = null;
  if (!isPermanent) {
    const days =
      body.expires_days === undefined
        ? DEFAULT_EXPIRY_DAYS
        : Number(body.expires_days);
    if (!Number.isInteger(days) || ![1, 7, 30].includes(days)) {
      return {
        error: '保留时长需为 1 天、7 天、30 天或永久',
        code: 'expires_invalid',
      };
    }
    expiresAt = Date.now() + days * DAY_MS;
  }
  return { expiresAt, isPermanent };
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function boundedInt(raw, fallback, min, max) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) return fallback;
  return Math.min(value, max);
}

async function handleListShares(url, env) {
  const page = boundedInt(url.searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = boundedInt(url.searchParams.get('page_size'), 20, 1, 50);
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 100);
  const tag = String(url.searchParams.get('tag') || '').trim().slice(0, 30);
  const permanentOnly = ['1', 'true'].includes(
    String(url.searchParams.get('permanent') || '').toLowerCase()
  );

  await ensureSchema(env);

  const where = [
    's.password_protected = 0',
    '(s.is_permanent = 1 OR s.expires_at > ?)',
  ];
  const params = [Date.now()];
  if (permanentOnly) {
    where.push('s.is_permanent = 1');
  }
  if (query) {
    const like = `%${escapeLike(query)}%`;
    where.push(
      "(s.alias LIKE ? ESCAPE '\\' OR s.title LIKE ? ESCAPE '\\' OR " +
        "s.description LIKE ? ESCAPE '\\' OR s.author LIKE ? ESCAPE '\\' OR " +
        "s.tags LIKE ? ESCAPE '\\')"
    );
    params.push(like, like, like, like, like);
  }
  if (tag) {
    where.push(
      'EXISTS (SELECT 1 FROM json_each(s.tags) AS je WHERE je.value = ?)'
    );
    params.push(tag);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM shares AS s ${whereSql}`
  )
    .bind(...params)
    .first();
  const total = countRow ? Number(countRow.count) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;

  const result = await env.DB.prepare(
    `SELECT s.alias, s.title, s.description, s.author, s.tags,
            s.file_type, s.is_permanent, s.expires_at, s.created_at
     FROM shares AS s
     ${whereSql}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all();
  const items = (result.results || []).map((row) => ({
    alias: row.alias,
    title: row.title,
    description: row.description,
    author: row.author,
    tags: parseTags(row.tags),
    fileType: normalizeFileType(row.file_type),
    isPermanent: row.is_permanent === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));

  return json({
    items,
    total,
    page: currentPage,
    pageSize,
    totalPages,
  });
}

async function requireManageRow(request, env, rawAlias) {
  const tokenHash = await manageTokenHash(request);
  if (!tokenHash) {
    return {
      response: json(
        { error: '需要携带 manage token', code: 'token_required' },
        401
      ),
    };
  }
  const normalized = normalizeAlias(rawAlias);
  if (normalized.error || normalized.generated) {
    return {
      response: json(
        { error: '分享不存在或无权管理', code: 'not_found' },
        404
      ),
    };
  }
  await ensureSchema(env);
  const row = await env.DB.prepare(
    `SELECT id, alias, title, description, author, tags, content, salt, iv,
            password_protected, expires_at, is_permanent, created_at,
            file_type, filename
     FROM shares WHERE alias = ? AND manage_token_hash = ?`
  )
    .bind(normalized.alias, tokenHash)
    .first();
  if (!row) {
    return {
      response: json(
        { error: '分享不存在或无权管理', code: 'not_found' },
        404
      ),
    };
  }
  if (!row.is_permanent && row.expires_at && row.expires_at <= Date.now()) {
    return { response: json({ error: '分享已过期', code: 'gone' }, 410) };
  }
  return { row };
}

async function handleMyShares(request, url, env) {
  const tokenHash = await manageTokenHash(request);
  if (!tokenHash) {
    return json(
      { error: '需要携带 manage token', code: 'token_required' },
      401
    );
  }
  const page = boundedInt(url.searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = boundedInt(url.searchParams.get('page_size'), 20, 1, 50);
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 100);
  const permanentOnly = ['1', 'true'].includes(
    String(url.searchParams.get('permanent') || '').toLowerCase()
  );

  await ensureSchema(env);

  const where = [
    's.manage_token_hash = ?',
    '(s.is_permanent = 1 OR s.expires_at > ?)',
  ];
  const params = [tokenHash, Date.now()];
  if (permanentOnly) where.push('s.is_permanent = 1');
  if (query) {
    const like = `%${escapeLike(query)}%`;
    where.push(
      "(s.alias LIKE ? ESCAPE '\\' OR s.title LIKE ? ESCAPE '\\' OR " +
        "s.description LIKE ? ESCAPE '\\' OR s.author LIKE ? ESCAPE '\\' OR " +
        "s.tags LIKE ? ESCAPE '\\')"
    );
    params.push(like, like, like, like, like);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM shares AS s ${whereSql}`
  )
    .bind(...params)
    .first();
  const total = countRow ? Number(countRow.count) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;

  const result = await env.DB.prepare(
    `SELECT s.alias, s.title, s.description, s.author, s.tags,
            s.file_type, s.filename, s.password_protected,
            s.is_permanent, s.expires_at, s.created_at
     FROM shares AS s
     ${whereSql}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, pageSize, offset)
    .all();
  const items = (result.results || []).map((row) => ({
    alias: row.alias,
    title: row.title,
    description: row.description,
    author: row.author,
    tags: parseTags(row.tags),
    fileType: normalizeFileType(row.file_type),
    filename: row.filename || '',
    passwordProtected: row.password_protected === 1,
    isPermanent: row.is_permanent === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));

  return json({
    items,
    total,
    page: currentPage,
    pageSize,
    totalPages,
  });
}

async function handleGetContent(request, env, rawAlias) {
  const owned = await requireManageRow(request, env, rawAlias);
  if (owned.response) return owned.response;
  const row = owned.row;

  const payload = {
    ok: true,
    alias: row.alias,
    content: bytesToBase64(toBytes(row.content)),
    password_protected: row.password_protected === 1,
    file_type: normalizeFileType(row.file_type),
    filename: row.filename || '',
  };
  if (row.password_protected === 1 && row.salt && row.iv) {
    payload.salt = bytesToBase64(toBytes(row.salt));
    payload.iv = bytesToBase64(toBytes(row.iv));
  }
  return json(payload);
}

async function handleUpdate(request, env, rawAlias) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误', code: 'invalid_json' }, 400);
  }

  const owned = await requireManageRow(request, env, rawAlias);
  if (owned.response) return owned.response;
  const row = owned.row;

  const validated = validateMeta(body);
  if (validated.error) {
    return json({ error: validated.error, code: validated.code }, 400);
  }

  const hasContent = typeof body.content === 'string' && body.content.trim() !== '';
  if (body.content !== undefined && !hasContent) {
    return json({ error: '内容不能为空', code: 'content_empty' }, 400);
  }

  let content = null;
  let salt = null;
  let iv = null;
  let passwordProtected = row.password_protected === 1;
  let fileType = normalizeFileType(row.file_type);
  let filename = row.filename || '';

  if (hasContent) {
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
    if (body.file_type !== undefined && body.file_type !== null && body.file_type !== '') {
      const requested = String(body.file_type).trim().toLowerCase();
      if (!FILE_TYPES[requested]) {
        return json({ error: '不支持的文件类型', code: 'file_type_invalid' }, 400);
      }
      fileType = requested;
    }
    const cleaned = cleanFilename(body.filename);
    if (cleaned.error) {
      return json({ error: cleaned.error, code: 'field_too_long' }, 400);
    }
    filename = cleaned;

    passwordProtected = body.password_protected === true;
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
    if (!passwordProtected && fileType === 'ics') {
      const text = sniffText(content);
      if (!text.includes('BEGIN:VCALENDAR')) {
        return json(
          { error: 'ICS 内容无效（缺少 BEGIN:VCALENDAR）', code: 'content_invalid' },
          400
        );
      }
    }
  } else {
    const wantsCrypto =
      body.password_protected !== undefined ||
      body.salt !== undefined ||
      body.iv !== undefined;
    if (wantsCrypto) {
      const sameState =
        body.password_protected !== undefined &&
        (body.password_protected === true) === (row.password_protected === 1) &&
        body.salt === undefined &&
        body.iv === undefined;
      if (!sameState) {
        return json(
          { error: '修改加密状态需要同时上传文件', code: 'content_required' },
          400
        );
      }
    }
    if (body.file_type !== undefined || body.filename !== undefined) {
      return json(
        { error: '修改文件类型需要同时上传文件', code: 'file_meta_without_content' },
        400
      );
    }
  }

  let expiresAt = row.expires_at;
  let isPermanent = row.is_permanent === 1;
  if (body.expires_days !== undefined) {
    const parsed = parseExpires(body);
    if (parsed.error) {
      return json({ error: parsed.error, code: parsed.code }, 400);
    }
    expiresAt = parsed.expiresAt;
    isPermanent = parsed.isPermanent;
  }

  const sets = [];
  const params = [];
  const assign = (column, value) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };
  assign('title', validated.meta.title !== undefined ? validated.meta.title : row.title);
  assign(
    'description',
    validated.meta.description !== undefined ? validated.meta.description : row.description
  );
  assign('author', validated.meta.author !== undefined ? validated.meta.author : row.author);
  assign(
    'tags',
    JSON.stringify(
      validated.meta.tags !== undefined ? validated.meta.tags : parseTags(row.tags)
    )
  );
  if (hasContent) {
    assign('content', content);
    assign('salt', salt);
    assign('iv', iv);
    assign('password_protected', passwordProtected ? 1 : 0);
    assign('file_type', fileType);
    assign('filename', filename);
  }
  assign('expires_at', expiresAt);
  assign('is_permanent', isPermanent ? 1 : 0);
  params.push(row.id);

  await env.DB.prepare(
    `UPDATE shares SET ${sets.join(', ')} WHERE id = ?`
  )
    .bind(...params)
    .run();

  return json({
    ok: true,
    alias: row.alias,
    path: `/s/${row.alias}`,
    permanent: isPermanent,
    expires_at: expiresAt,
    password_protected: passwordProtected,
  });
}

async function handleDelete(request, env, rawAlias) {
  const owned = await requireManageRow(request, env, rawAlias);
  if (owned.response) return owned.response;
  const row = owned.row;
  await env.DB.prepare('DELETE FROM shares WHERE id = ?').bind(row.id).run();
  return json({ ok: true, alias: row.alias });
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

  const validated = validateMeta(body);
  if (validated.error) {
    return json({ error: validated.error, code: validated.code }, 400);
  }
  const title = validated.meta.title ?? '';
  const description = validated.meta.description ?? '';
  const author = validated.meta.author ?? '';
  const tags = validated.meta.tags ?? [];

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

  let fileType = 'html';
  if (body.file_type !== undefined && body.file_type !== null && body.file_type !== '') {
    const requested = String(body.file_type).trim().toLowerCase();
    if (!FILE_TYPES[requested]) {
      return json({ error: '不支持的文件类型', code: 'file_type_invalid' }, 400);
    }
    fileType = requested;
  }
  const filename = cleanFilename(body.filename);
  if (filename.error) {
    return json({ error: filename.error, code: 'field_too_long' }, 400);
  }
  if (body.password_protected !== true && fileType === 'ics') {
    const text = sniffText(content);
    if (!text.includes('BEGIN:VCALENDAR')) {
      return json(
        { error: 'ICS 内容无效（缺少 BEGIN:VCALENDAR）', code: 'content_invalid' },
        400
      );
    }
  }

  await ensureSchema(env);

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM shares')
    .first();
  if (countRow && Number(countRow.count) >= MAX_SHARES) {
    return json(
      { error: '空间不足，请稍后尝试', code: 'storage_full' },
      503
    );
  }

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

  const parsedExpires = parseExpires(body);
  if (parsedExpires.error) {
    return json({ error: parsedExpires.error, code: parsedExpires.code }, 400);
  }
  const { expiresAt, isPermanent } = parsedExpires;

  let manageTokenHash = null;
  if (body.manage_token !== undefined && body.manage_token !== null && body.manage_token !== '') {
    if (typeof body.manage_token !== 'string' || !isStrongToken(body.manage_token.trim())) {
      return json({ error: 'manage token 格式错误', code: 'token_invalid' }, 400);
    }
    manageTokenHash = await hashToken(body.manage_token.trim());
  }

  const createdAt = Date.now();
  let alias = normalized.generated ? crypto.randomUUID() : normalized.alias;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await env.DB.prepare(
        `INSERT INTO shares
          (alias, title, description, author, tags, content, salt, iv, password_protected, expires_at, is_permanent, created_at, file_type, filename, manage_token_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          alias,
          title,
          description,
          author,
          JSON.stringify(tags),
          content,
          salt,
          iv,
          passwordProtected ? 1 : 0,
          expiresAt,
          isPermanent ? 1 : 0,
          createdAt,
          fileType,
          filename,
          manageTokenHash
        )
        .run();
      return json({
        ok: true,
        alias,
        path: `/s/${alias}`,
        permanent: isPermanent,
        expires_at: expiresAt,
      });
    } catch (error) {
      if (
        !normalized.generated ||
        !String(error.message).includes('UNIQUE') ||
        attempt === 4
      ) {
        if (String(error.message).includes('UNIQUE')) {
          return json({ error: 'alias 已被占用', code: 'alias_taken' }, 409);
        }
        throw error;
      }
      alias = crypto.randomUUID();
    }
  }
}

async function handleView(request, env) {
  const url = new URL(request.url);
  const encoded = url.pathname.slice('/s/'.length);
  let alias;
  try {
    alias = decodeURIComponent(encoded);
  } catch {
    return simplePage(404, 'notFound', request);
  }
  const normalized = normalizeAlias(alias);
  if (normalized.error) {
    return simplePage(404, 'notFound', request);
  }
  await ensureSchema(env);

  const row = await env.DB.prepare(
    `SELECT id, alias, title, description, author, tags, content, salt, iv,
            password_protected, expires_at, is_permanent, created_at,
            file_type, filename
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
    tags: parseTags(row.tags),
    passwordProtected: row.password_protected === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPermanent: row.is_permanent === 1,
    fileType: normalizeFileType(row.file_type),
    filename: row.filename || '',
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

function headerFilename(filename) {
  const ascii = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function handleRaw(request, env) {
  const url = new URL(request.url);
  let encoded = url.pathname.slice('/s/'.length);
  if (encoded.endsWith('/raw')) {
    encoded = encoded.slice(0, -'/raw'.length);
  }
  let alias;
  try {
    alias = decodeURIComponent(encoded);
  } catch {
    return json({ error: '分享不存在', code: 'not_found' }, 404);
  }
  const normalized = normalizeAlias(alias);
  if (normalized.error) {
    return json({ error: '分享不存在', code: 'not_found' }, 404);
  }
  await ensureSchema(env);

  const row = await env.DB.prepare(
    `SELECT id, alias, content, salt, iv, password_protected,
            expires_at, is_permanent, file_type, filename
     FROM shares WHERE alias = ?`
  )
    .bind(normalized.alias)
    .first();

  if (!row) {
    return json({ error: '分享不存在', code: 'not_found' }, 404);
  }
  const now = Date.now();
  if (!row.is_permanent && row.expires_at && row.expires_at <= now) {
    await env.DB.prepare('DELETE FROM shares WHERE id = ?').bind(row.id).run();
    return json({ error: '分享已过期', code: 'gone' }, 410);
  }
  if (row.password_protected === 1) {
    return json(
      { error: '私密分享不提供 raw 数据', code: 'raw_forbidden' },
      403
    );
  }

  const fileType = normalizeFileType(row.file_type);
  const meta = FILE_TYPES[fileType];
  const filename =
    row.filename || `${row.alias}.${meta.exts[0]}`;

  return new Response(toBytes(row.content), {
    headers: {
      'content-type': `${meta.mime}; charset=utf-8`,
      'content-disposition': headerFilename(filename),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
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

    if (request.method === 'GET' && pathname === '/api/status') {
      return handleStatus(env);
    }
    if (request.method === 'GET' && pathname === '/api/alias-check') {
      return handleAliasCheck(url, env);
    }
    if (request.method === 'GET' && pathname === '/api/shares') {
      return handleListShares(url, env);
    }
    if (request.method === 'POST' && pathname === '/api/share') {
      return handleCreate(request, env);
    }
    if (request.method === 'GET' && pathname === '/api/my-shares') {
      return handleMyShares(request, url, env);
    }
    if (
      request.method === 'GET' &&
      pathname.startsWith('/api/share/') &&
      pathname.endsWith('/content')
    ) {
      const encoded = pathname.slice('/api/share/'.length, -'/content'.length);
      let alias;
      try {
        alias = decodeURIComponent(encoded);
      } catch {
        return json({ error: '分享不存在或无权管理', code: 'not_found' }, 404);
      }
      return handleGetContent(request, env, alias);
    }
    if (
      (request.method === 'PATCH' || request.method === 'DELETE') &&
      pathname.startsWith('/api/share/')
    ) {
      const encoded = pathname.slice('/api/share/'.length);
      let alias;
      try {
        alias = decodeURIComponent(encoded);
      } catch {
        return json({ error: '分享不存在或无权管理', code: 'not_found' }, 404);
      }
      return request.method === 'PATCH'
        ? handleUpdate(request, env, alias)
        : handleDelete(request, env, alias);
    }
    if (
      request.method === 'GET' &&
      pathname.startsWith('/s/') &&
      pathname.endsWith('/raw') &&
      pathname !== '/s/raw'
    ) {
      return handleRaw(request, env);
    }
    if (request.method === 'GET' && pathname.startsWith('/s/')) {
      return handleView(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env) {
    const removed = await cleanupExpired(env);
    console.log(`cleaned ${removed} expired shares`);
  },
};
