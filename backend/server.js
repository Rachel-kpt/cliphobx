// ClipHub backend — รัน: node backend/server.js (ไม่ต้อง npm install)
const http = require('http);
const fs = require('fs);
const path = require('path);
const crypto = require('crypto);

const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data.json);
const ADMIN = { user: 'admin', pass: 'admin123' };

let db = { clips: [], views: {} };
try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { save(); }
function save() { fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }

function parseBody(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); }
    });
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function ok(res, obj) { json(res, 200, obj); }
function err(res, code, msg) { json(res, code, { error: msg }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const p = url.pathname;

  // เสิร์ฟไฟล์ frontend
  if (req.method === 'GET' && !p.startsWith('/api')) {
    let f = p === '/' ? '/index.html' : p;
    const fp = path.join(__dirname, '..', 'frontend', f);
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      const ext = path.extname(fp);
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
      res.writeHead(200, { 'Content-Type': (types[ext] || 'application/octet-stream') + '; charset=utf-8' });
      return fs.createReadStream(fp).pipe(res);
    }
  }

  if (!p.startsWith('/api')) return err(res, 404, 'not found');

  // API
  if (p === '/api/login' && req.method === 'POST') {
    const b = await parseBody(req);
    if (b.user === ADMIN.user && b.pass === ADMIN.pass) {
      const token = crypto.randomBytes(16).toString('hex');
      return ok(res, { token, user: ADMIN.user });
    }
    return err(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  if (p === '/api/clips' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const tag = url.searchParams.get('tag') || '';
    let list = db.clips.slice().reverse();
    if (q) list = list.filter(c => (c.title + ' ' + (c.desc || '')).toLowerCase().includes(q));
    if (tag) list = list.filter(c => (c.tags || []).includes(tag));
    return ok(res, list);
  }

  if (p === '/api/clips' && req.method === 'POST') {
    const b = await parseBody(req);
    if (!b.title || !b.url) return err(res, 400, 'ต้องมี title กับ url');
    const clip = {
      id: crypto.randomBytes(8).toString('hex'),
      title: b.title,
      url: b.url,
      desc: b.desc || '',
      tags: b.tags || [],
      thumb: b.thumb || '🎬',
      created: Date.now(),
      published: b.published !== false
    };
    db.clips.push(clip); save();
    return ok(res, clip);
  }

  const m = p.match(/^\/api\/clips\/([a-z0-9]+)$/);
  if (m) {
    const id = m[1];
    const i = db.clips.findIndex(c => c.id === id);
    if (i < 0) return err(res, 404, 'ไม่พบคลิป');
    if (req.method === 'GET') return ok(res, db.clips[i]);
    if (req.method === 'PUT') {
      const b = await parseBody(req);
      db.clips[i] = { ...db.clips[i], ...b, id }; save();
      return ok(res, db.clips[i]);
    }
    if (req.method === 'DELETE') {
      db.clips.splice(i, 1); save();
      return ok(res, { ok: true });
    }
  }

  if (p === '/api/view' && req.method === 'POST') {
    const b = await parseBody(req);
    if (b.id) { db.views[b.id] = (db.views[b.id] || 0) + 1; save(); }
    return ok(res, { views: db.views[b.id] || 0 });
  }

  if (p === '/api/stats' && req.method === 'GET') {
    const total = db.clips.length;
    const pub = db.clips.filter(c => c.published).length;
    const views = Object.values(db.views).reduce((a, b) => a + b, 0);
    const tags = {};
    db.clips.forEach(c => (c.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1));
    return ok(res, { total, pub, views, tags });
  }

  err(res, 404, 'ไม่พบ API นี้');
});

server.listen(PORT, () => console.log('ClipHub รันที่ http://localhost:' + PORT));
