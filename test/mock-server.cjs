// Máy chủ GIẢ cho kiểm thử cục bộ: phục vụ site/ + /api giả (Pixabay giả, AI chọn chữ giả có "stock").
// node test/mock-server.cjs 8791   → http://localhost:8791  (file giả: /home/claude/testmedia/stock/city.mp4, money.jpg)
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'site');
const M = '/home/claude/testmedia/stock/';
const port = +(process.argv[2] || 8791);
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4'};
const log = [];
const json = (res, o, s = 200) => {
  res.writeHead(s, {'content-type': 'application/json'});
  res.end(JSON.stringify(o));
};
http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname.replace(/^\/+/, '/');
    if (p === '/api/health') return json(res, {ai: true, provider: 'mock', stt: false, vision: false, stock: true});
    if (p === '/api/_log') return json(res, log);
    if (p === '/api/stock') {
      log.push(['search', u.searchParams.get('type'), u.searchParams.get('q')]);
      const type = u.searchParams.get('type');
      const items =
        type === 'image'
          ? [{id: 902, type: 'image', page: 'https://pixabay.com/photos/902', user: 'nguoichup', tags: 'money, coins', thumb: '/api/stock-file?u=https://cdn.pixabay.com/money.jpg', view: '', url: 'https://cdn.pixabay.com/money.jpg', w: 1280, h: 853}]
          : [{id: 901, type: 'video', page: 'https://pixabay.com/videos/901', user: 'nguoiquay', tags: 'city, skyline', dur: 8, thumb: '/api/stock-file?u=https://cdn.pixabay.com/city.jpg', url: 'https://cdn.pixabay.com/city.mp4', w: 1280, h: 720, size: 2900000}];
      return json(res, {items, total: 1, source: 'Pixabay'});
    }
    if (p === '/api/stock-file') {
      const f = (u.searchParams.get('u') || '').split('/').pop();
      log.push(['file', f]);
      const fp = path.join(M, path.basename(f));
      if (!fs.existsSync(fp)) return json(res, {error: 'không có'}, 404);
      res.writeHead(200, {'content-type': TYPES[path.extname(fp)] || 'application/octet-stream'});
      return fs.createReadStream(fp).pipe(res);
    }
    if (p === '/api/ai' && req.method === 'POST') {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => {
        const body = JSON.parse(b || '{}');
        log.push(['ai', body.mode]);
        if (body.mode === 'highlight') return json(res, {items: [], hook: '', pack: '', place: '', pics: [], sfx: [], stock: [{start: 4.5, q: 'city skyline'}, {start: 12, q: 'money'}, {start: 9, q: 'house interior'}], provider: 'mock'});
        return json(res, {reply: 'ok', ops: []});
      });
      return;
    }
    if (p.startsWith('/api/')) return json(res, {error: 'không có'}, 404);
    let fp = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(ROOT, 'index.html');
    res.writeHead(200, {'content-type': TYPES[path.extname(fp)] || 'application/octet-stream'});
    fs.createReadStream(fp).pipe(res);
  })
  .listen(port, () => console.log('mock on', port));
