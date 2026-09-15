const http = require('http');

function req(method, path, { body, token } = {}) {
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
  const { db } = require('../server/db');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1").all().map((r) => r.name);
  console.log('tables', tables.join(','));
  console.log('users cols', db.prepare('PRAGMA table_info(users)').all().map((c) => c.name).join(','));
  console.log('catalog', db.prepare("SELECT COUNT(*) n FROM robots WHERE source='catalog'").get().n);

  const admin = await req('POST', '/api/auth/login', {
    body: { email: 'admin@theofficialrobot.com', password: 'AdminRobot2026!' }
  });
  console.log('admin login', admin.status, admin.json.user && admin.json.user.role, admin.json.user && admin.json.user.emailVerified, !!admin.json.token);

  const overview = await req('GET', '/api/admin/overview', { token: admin.json.token });
  console.log('overview', overview.status, overview.json);

  const email = 'buyer.verify.' + Date.now() + '@example.com';
  const reg = await req('POST', '/api/auth/register', {
    body: { name: 'Test Buyer', email, password: 'RobotPass1' }
  });
  console.log('register', reg.status, Object.keys(reg.json), !!reg.json.token, !!reg.json.verifyUrl);

  const unv = await req('POST', '/api/auth/login', { body: { email, password: 'RobotPass1' } });
  console.log('unverified login', unv.status, unv.json.code, unv.json.error);

  const verify = await req('GET', '/api/auth/verify?token=' + encodeURIComponent((reg.json.verifyUrl || '').split('token=')[1] || ''));
  console.log('verify', verify.status, !!verify.json.token, verify.json.user && verify.json.user.emailVerified);

  const go2 = await req('GET', '/api/robots/go2');
  console.log('go2 reviews', Array.isArray(go2.json.reviews) || Array.isArray(go2.json.robot && go2.json.robot.reviews), 'avg', go2.json.robot && go2.json.robot.ratingAvg);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
