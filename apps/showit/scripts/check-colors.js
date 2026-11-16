#!/usr/bin/env node
/**
 * Colour rule (owner, 16 Nov 2026): every colour lives in src/theme.ts under a name that says its
 * job (background, surface, accent, on-accent, danger...). Screens take colours from useColors() or
 * from the fixed sets in theme.ts (PIN_COLORS, ART, PERSON_COLORS, STAGE_COLORS) and never write a
 * hex, rgb(), hsl() or colour word themselves. That way the whole app changes colour from one file.
 *
 * Runs with `npm run typecheck`. A line that truly needs a written colour (a printed PDF page, not
 * the app) can say `colors-ok: <why>` on that line or the line above.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const allowedFiles = new Set([path.join(root, 'theme.ts')]);
const checks = [
  [/(?<![\w&$])#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})\b/, 'hex colour'],
  [/\b(?:rgba?|hsla?)\s*\(/, 'rgb()/hsl() colour'],
  [/\b(?:color|backgroundColor|borderColor|tintColor|shadowColor|fill|stroke)\s*[:=]\s*\{?\s*['"](?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink)['"]/, 'colour word'],
];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(e.name) && !allowedFiles.has(p) ? [p] : [];
  });
}

// Blank out comments (keeps line numbers) so notes like "(#101)" are not read as colours.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
}

const problems = [];
for (const file of files(root)) {
  const raw = fs.readFileSync(file, 'utf8').split('\n');
  const lines = stripComments(raw.join('\n')).split('\n');
  lines.forEach((line, i) => {
    if (/colors-ok/.test(raw[i]) || (i > 0 && /colors-ok/.test(raw[i - 1]))) return;
    for (const [re, what] of checks) {
      const m = line.match(re);
      if (m) problems.push(`${path.relative(path.join(root, '..'), file)}:${i + 1}  ${what} "${m[0]}" — use a role from useColors() or a set in src/theme.ts`);
    }
  });
}

if (problems.length) {
  console.error(`Colour rule: ${problems.length} written-in colour(s) outside src/theme.ts\n` + problems.join('\n'));
  process.exit(1);
}
console.log('Colour rule: OK, every colour comes from src/theme.ts');
