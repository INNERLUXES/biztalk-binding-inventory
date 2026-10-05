import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ADAPTER_TARGETS, B2B_PREFIXES, BUILT_IN_PREFIXES, KIND_BASIS, NOTICE, POINTS, RULES, SOURCES, pointPage, source } from '../src/index.js';
import { configOf } from './helpers.js';
import { fileURLToPath } from 'node:url';

// The public pages the inventory rests on: every page of src/data.js is listed in research/sources.md and in
// docs/rules-and-sources.md, every rule and target names points that exist, and no point is a long quote.

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');

test('data: every page has an id, a title and an https address with no number that reads like a year, and every point names a page', () => {
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  for (const s of SOURCES) {
    assert.match(s.url, /^https:\/\/[a-z0-9.-]+\//, s.id);
    assert.doesNotMatch(s.url, /(?:19|20)\d{2}/, s.id);
    assert.ok(s.title.length > 10, s.id);
  }
  for (const [key, p] of Object.entries(POINTS)) {
    assert.ok(source(p.source), `${key}: ${p.source}`);
    assert.equal(pointPage(key).id, p.source);
    assert.ok(p.text.length < 300, `${key} is short`);
    assert.ok(!/"[^"]{20,}"/.test(p.text), `${key} is written in this project's own words, with no long quotation`);
  }
  for (const s of SOURCES) assert.ok(Object.values(POINTS).some((p) => p.source === s.id), `${s.id} is used by a point`);
  for (const u of ['https://learn.microsoft.com/en-us/biztalk/core/binding-files-and-application-deployment', 'https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-migration-overview', 'https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html']) assert.ok(SOURCES.some((s) => s.url === u), u);
});

test('data: the points name what the inventory leans on', () => {
  assert.match(POINTS.exportNoPasswords.text, /takes the passwords out/);
  assert.match(POINTS.xxeRejectDoctype.text, /DOCTYPE/);
  assert.match(POINTS.xxeDenialOfService.text, /billion laughs/);
  for (const s of ['API Management', 'Logic Apps', 'Service Bus', 'Event Grid', 'Functions']) assert.ok(POINTS.aisServices.text.includes(s), s);
  for (const a of ['FILE', 'FTP', 'MQSeries', 'MSMQ', 'SMTP', 'POP3', 'SOAP']) assert.ok(POINTS.nativeAdapters.text.includes(a), a);
});

test('data: every rule and target names points that exist, the ids and keys are unique, and every rule says what to change', () => {
  for (const r of RULES) {
    assert.ok(r.basis.length > 0, r.id);
    for (const k of r.basis) assert.ok(POINTS[k], `${r.id}: ${k}`);
    assert.match(r.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof r.rule(configOf()), 'string');
    assert.ok(r.own.length > 20, r.id);
    assert.ok(r.fix.length > 10, r.id);
    assert.ok(r.title.length > 10, r.id);
  }
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  assert.equal(new Set(RULES.filter((r) => r.key).map((r) => r.key)).size, RULES.filter((r) => r.key).length);
  for (const e of ADAPTER_TARGETS) for (const k of e.basis) assert.ok(POINTS[k], `${e.adapters[0]}: ${k}`);
  for (const [kind, basis] of Object.entries(KIND_BASIS)) for (const k of basis) assert.ok(POINTS[k], `${kind}: ${k}`);
  const adapters = ADAPTER_TARGETS.flatMap((e) => e.adapters.map((a) => a.toLowerCase()));
  assert.equal(new Set(adapters).size, adapters.length, 'no adapter is named twice');
  const used = new Set([...RULES.flatMap((r) => r.basis), ...ADAPTER_TARGETS.flatMap((e) => e.basis), ...Object.values(KIND_BASIS).flat()]);
  for (const k of Object.keys(POINTS).filter((x) => !used.has(x))) assert.ok(['mapsToTransforms', 'biztalkLifecycle', 'fixedLifecycle', 'csvRecords', 'csvInjection', 'jsonUtf8', 'jsonRepeatedNames', 'githubAnnotations'].includes(k), `${k} is used by no rule or target`);
  assert.ok(B2B_PREFIXES.every((p) => BUILT_IN_PREFIXES.includes(p)), 'an EDI pipeline is built in');
  assert.ok(NOTICE.startsWith('This inventory reads the binding files as they are written.'));
  assert.ok(NOTICE.includes('not a migration plan and not a certification'));
  assert.ok(NOTICE.includes('docs/limits.md'));
});

test('research/sources.md: lists every page with its address, in its own words', async () => {
  const note = await read('research/sources.md');
  for (const s of SOURCES) assert.ok(note.includes(s.url), s.url);
  assert.ok(note.includes('Each page was fetched and read before it was listed.'));
  const quotes = note.match(/"[^"]{60,}"/g) ?? [];
  assert.deepEqual(quotes, [], 'no long quotation');
  assert.ok(!note.includes('\r'));
});

test('docs/rules-and-sources.md: every rule with its points, its choice and its fix, every page and every target', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const r of RULES) {
    assert.ok(doc.includes(`### \`${r.id}\``), r.id);
    for (const k of r.basis) assert.ok(doc.includes(POINTS[k].text.slice(1)), `${r.id}: ${k}`);
    assert.ok(doc.includes(r.fix.slice(1)), `${r.id}: fix`);
    assert.ok(doc.includes(r.own.slice(1)), `${r.id}: own`);
  }
  for (const s of SOURCES) assert.ok(doc.includes(s.url), s.url);
  for (const e of ADAPTER_TARGETS) for (const a of e.adapters) assert.ok(doc.includes(`| \`${a}\` | ${e.target} |`), a);
});
