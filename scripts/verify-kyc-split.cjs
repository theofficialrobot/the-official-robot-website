const http = require('http');
const { db } = require('../server/db');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = http.request({ hostname: '127.0.0.1', port: 3001, path, method, headers }, (res) => {
      let s = '';
      res.on('data', (c) => { s += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(s); } catch { json = { raw: s }; }
        resolve({ status: res.statusCode, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  console.log('comments table', tables.includes('comments'));
  const r = await req('POST', '/api/auth/register', {
    email: 'sales@acmerobotics.test',
    password: 'RobotPass1#',
    accountType: 'reseller',
    companyName: 'Acme Robotics'
  });
  console.log('reseller', r.status, r.json.error || ((r.json.user && r.json.user.accountType) + ' ' + (r.json.user && r.json.user.name)));
  const g = await req('POST', '/api/auth/register', {
    email: 'x@gmail.com',
    password: 'RobotPass1#',
    accountType: 'reseller',
    companyName: 'Acme'
  });
  console.log('reseller gmail', g.status, g.json.error);
  const login = await req('POST', '/api/auth/login', {
    email: 'admin@theofficialrobot.com',
    password: 'AdminRobot2026!'
  });
  const tok = login.json.token;
  const list = await req('GET', '/api/admin/listings?bucket=used', null, tok);
  console.log('used listings', list.status, 'used', list.json.usedCount, 'new', list.json.newCount);
  const c = await req('GET', '/api/admin/comments', null, tok);
  console.log('admin comments', c.status);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
