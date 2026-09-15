const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'store.html');
let html = fs.readFileSync(file, 'utf8');
const marker = '<script>\nconst ROBOTS = {';
const i = html.indexOf(marker);
if (i < 0) {
  console.error('ROBOTS script marker not found');
  process.exit(1);
}
const end = html.indexOf('</script>', i);
if (end < 0) {
  console.error('script end not found');
  process.exit(1);
}
html = html.slice(0, i)
  + '<script src="data/robots.js"></script>\n<script src="js/store.js"></script>'
  + html.slice(end + '</script>'.length);
html = html.replace('Cart saved in this browser via IndexedDB.', 'Cart saved in this browser.');
fs.writeFileSync(file, html, 'utf8');
console.log('store.html bytes', fs.statSync(file).size);
console.log('inlined ROBOTS', /const ROBOTS =/.test(html));
console.log('robots.js tag', html.includes('data/robots.js'));
console.log('store.js tag', html.includes('js/store.js'));
console.log('IndexedDB', html.includes('IndexedDB'));
