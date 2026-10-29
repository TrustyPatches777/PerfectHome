/**
 * Finds user-visible strings in src/ that are not yet going through t() / N_(), so a new feature can be checked for them:
 *   node scripts/i18n-scan.mjs            list them (file:line  kind  text)
 *   node scripts/i18n-scan.mjs --count    only the number per file
 * It is a heuristic (JSX text, text attributes, toasts, `label:` style properties): a clean list is not a proof, the Korean sweep in
 * e2e/m39-korean.spec.ts looks at what really shows on the screen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TEXT_ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label']);
const TEXT_PROPS = new Set(['label', 'title', 'name', 'hint', 'text', 'desc', 'description', 'help', 'message', 'msg', 'tip', 'summary', 'caption']);
const TEXT_CALLS = new Set(['showToast', 'confirm', 'alert', 'prompt']);

export function listFiles(dir = path.join(root, 'src')) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !p.includes(`${path.sep}i18n${path.sep}`)) out.push(p);
  }
  return out;
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', times: '×', hellip: '…', minus: '−', deg: '°', plusmn: '±', larr: '←', rarr: '→' };
export const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? m)));

/** What JSX does with the whitespace of a text: lines are trimmed and joined by one space. */
export function jsxCollapse(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const kept = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ');
    if (i > 0) l = l.replace(/^ +/, '');
    if (i < lines.length - 1) l = l.replace(/ +$/, '');
    if (l) kept.push(l);
  });
  return kept.join(' ');
}

const hasLetters = (s) => /[A-Za-z가-힣]{2,}/.test(s) && !looksTechnical(s);

/** Colors, ids, cursors, css: never shown to people. */
function looksTechnical(s) {
  const x = s.trim();
  if (/ /.test(x)) return /^(rgba?|hsla?)\(/i.test(x);
  return /^(rgba?\(|hsla?\(|#[0-9a-f]{3,8}$|[a-z]+-(resize|pointer|grab|text)$|[a-z0-9]+(-[a-z0-9${}.]+)+$|[a-z]+\$\{)/i.test(x);
}

/** Walks an ESTree and calls fn(node, parent, key) for every node. */
export function walk(node, fn, parent = null, key = '') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, fn, parent, key));
  if (node.type) fn(node, parent, key);
  for (const k of Object.keys(node)) if (k !== 'type' && k !== 'start' && k !== 'end') walk(node[k], fn, node, k);
}

export const parse = (code) => parseAst(code, { lang: 'tsx', sourceType: 'module' });

const calleeName = (c) => (!c ? '' : c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? calleeName(c.property) : '');

/** All candidate strings of one file: { start, end, kind, text, safe } */
export function candidates(code, file) {
  const ast = parse(code);
  const found = [];
  const inT = new WeakSet(); // string nodes already inside t() / N_()
  walk(ast, (n) => {
    if (n.type === 'CallExpression' && ['t', 'tx', 'N_'].includes(calleeName(n.callee))) walk(n.arguments, (m) => inT.add(m));
  });
  const lineOf = (pos) => code.slice(0, pos).split('\n').length;
  const add = (n, kind, text, extra = {}) => found.push({ file, line: lineOf(n.start), start: n.start, end: n.end, kind, text, ...extra });

  walk(ast, (n, parent) => {
    if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
      const kids = n.children;
      kids.forEach((c, i) => {
        if (c.type !== 'JSXText') return;
        const text = decode(jsxCollapse(c.raw ?? c.value));
        if (!hasLetters(text)) return;
        // text next to a {value}: one phrase in pieces, to be done by hand
        const side = (j) => {
          for (let k = j; k >= 0 && k < kids.length; k += j === i - 1 ? -1 : 1) {
            const s = kids[k];
            if (s.type === 'JSXText' && !s.value.trim()) continue;
            return s;
          }
          return null;
        };
        const prev = side(i - 1);
        const next = side(i + 1);
        const attached = [prev, next].some((s) => s && s.type === 'JSXExpressionContainer' && s.expression.type !== 'JSXEmptyExpression');
        add(c, 'jsx-text', text, { safe: !attached });
      });
    } else if (n.type === 'JSXAttribute' && n.value && n.value.type === 'Literal' && typeof n.value.value === 'string') {
      const name = n.name.type === 'JSXIdentifier' ? n.name.name : '';
      if (TEXT_ATTRS.has(name) && hasLetters(n.value.value)) add(n.value, 'attr:' + name, n.value.value, { safe: true });
    } else if (n.type === 'Literal' && typeof n.value === 'string' && !inT.has(n)) {
      if (parent?.type === 'JSXAttribute' || parent?.type === 'ImportDeclaration' || parent?.type === 'ExportAllDeclaration') return;
    } else if (n.type === 'CallExpression' && TEXT_CALLS.has(calleeName(n.callee))) {
      for (const a of n.arguments) if ((a.type === 'Literal' && typeof a.value === 'string') || a.type === 'TemplateLiteral' || a.type === 'ConditionalExpression' || a.type === 'BinaryExpression') add(a, 'call:' + calleeName(n.callee), code.slice(a.start, a.end), { safe: false });
    } else if (n.type === 'Property' && !n.computed) {
      const k = n.key.type === 'Identifier' ? n.key.name : n.key.type === 'Literal' ? String(n.key.value) : '';
      if (TEXT_PROPS.has(k) && n.value.type === 'Literal' && typeof n.value.value === 'string' && hasLetters(n.value.value) && !inT.has(n.value)) add(n.value, 'prop:' + k, n.value.value, { safe: false });
    } else if (n.type === 'JSXExpressionContainer' && parent?.type !== 'JSXAttribute') {
      // {cond ? 'a' : 'b'}, {'text'}
      const e = n.expression;
      const lits = [];
      walk(e, (m, p) => {
        if (m.type === 'Literal' && typeof m.value === 'string' && hasLetters(m.value) && !inT.has(m) && p && ['ConditionalExpression', 'LogicalExpression'].includes(p.type)) lits.push(m);
        if (m.type === 'TemplateLiteral' && m.quasis.some((q) => hasLetters(q.value.cooked ?? '')) && !inT.has(m)) lits.push(m);
      });
      for (const m of lits) add(m, 'jsx-expr', code.slice(m.start, m.end), { safe: false });
    }
  });
  return found;
}

const main = () => {
  const countOnly = process.argv.includes('--count');
  let total = 0;
  const per = [];
  for (const f of listFiles()) {
    const code = fs.readFileSync(f, 'utf8');
    let list = [];
    try {
      list = candidates(code, f);
    } catch (e) {
      console.error('cannot parse', f, e.message);
    }
    list = list.filter((c) => !/^t\(|^N_\(/.test(c.text));
    if (!list.length) continue;
    total += list.length;
    per.push([path.relative(root, f), list.length]);
    if (!countOnly) for (const c of list) console.log(`${path.relative(root, f)}:${c.line}  ${c.kind.padEnd(14)} ${c.safe ? ' ' : '*'} ${c.text.replace(/\s+/g, ' ').slice(0, 110)}`);
  }
  if (countOnly) per.sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(String(n).padStart(4), f));
  console.log(`\n${total} candidates in ${per.length} files (* = needs a hand)`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
