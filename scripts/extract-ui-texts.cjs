const fs = require('fs');

const file = process.argv[2] || 'App.tsx';
const src = fs.readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);

const results = [];

function add(kind, line, text) {
  if (!text) return;
  const t = text.trim();
  if (!t) return;
  // Skip obvious non-UI strings
  if (/^(https?:\/\/|\/api\b)/i.test(t)) return;
  if (/^(\{.*\}|<.*>)$/.test(t)) return;
  results.push({ kind, line, text: t });
}

const jsxRe = />\s*([^<>{}][^<>{}]*)\s*</g;
const attrRe = /\bplaceholder\s*=\s*"([^"]+)"/g;
const alertRe = /alert\(\s*(`([^`]+)`|'([^']+)'|"([^"]+)")/g;
const logRe = /addLog\([^,]+,[^,]+,\s*(`([^`]+)`|'([^']+)'|"([^"]+)")/g;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let m;
  while ((m = jsxRe.exec(line))) add('JSX', i + 1, m[1]);
  while ((m = attrRe.exec(line))) add('Attr', i + 1, m[1]);
  while ((m = alertRe.exec(line))) add('Alert', i + 1, m[2] || m[3] || m[4]);
  while ((m = logRe.exec(line))) add('Log', i + 1, m[2] || m[3] || m[4]);
}

// Deduplicate by text
const map = new Map();
for (const r of results) {
  if (!map.has(r.text)) map.set(r.text, r);
}
const out = [...map.values()].sort((a, b) => a.line - b.line);
console.log(JSON.stringify(out, null, 2));

