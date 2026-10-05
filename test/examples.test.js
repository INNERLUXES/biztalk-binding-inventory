import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLEAN, EXPECTED, MESSY, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const FILE = 'examples/messy/Quillmoor.Orders.BindingInfo.xml';

test('examples: the messy application fails with the report that is saved in examples/output', async () => {
  const r = await run(MESSY);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('messy.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the clean application passes with the report that is saved', async () => {
  const r = await run(CLEAN);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('clean.txt'));
  assert.match(r.out, /\nfindings: 0\n/);
  assert.equal((await run([...CLEAN, '--fail-on', 'info'])).code, 0);
  assert.equal((await run([...CLEAN, '--config', 'examples/config.json', '--fail-on', 'info'])).code, 0, 'the clean application passes the configuration of the other example too');
  assert.equal((await run(['examples/clean', '--fail-on', 'info'])).code, 0, 'and so does its folder');
});

test('examples: --explain, JSON, CSV, the GitHub commands and the defaults are the reports that are saved, and none holds a password', async () => {
  const outputs = { 'messy-explain.txt': [...MESSY, '--explain'], 'messy.json': [...MESSY, '--json', '--explain'], 'messy-inventory.csv': [...MESSY, '--format', 'csv'], 'messy-github.txt': [...MESSY, '--format', 'github'], 'defaults.json': ['--print-defaults'] };
  for (const [name, args] of Object.entries(outputs)) {
    const out = (await run(args)).out;
    assert.equal(out, await saved(name), name);
    assert.ok(!out.includes('plain-text-demo'), name);
  }
});

test('examples: the rules that fire on the messy application, each on the element built for it', async () => {
  const report = JSON.parse((await run([...MESSY, '--json'])).out);
  const lines = (await readFile(resolve(root, FILE), 'utf8')).split('\n');
  // The line of the element that opens with this text.
  const at = (start) => `${FILE}:${lines.findIndex((l) => l.trimStart().startsWith(start)) + 1}`;
  const byRule = {};
  for (const x of report.findings) (byRule[x.rule] ??= []).push(x.at);
  assert.deepEqual(byRule, {
    'plain-text-credential': [`${FILE}:${lines.findIndex((l) => l.includes('plain-text-demo&lt;')) + 1}`, at('<Address>ftp://qm_orders')],
    'duplicate-address': [at('<ReceiveLocation Name="RL_Orders_File_Old">')],
    'custom-pipeline': [at('<SendPort Name="SP_ArchiveFile"'), at('<ReceiveLocation Name="RL_Orders_File">')],
    'orphan-send-port': [at('<SendPort Name="SP_LegacyAudit"')],
    'dynamic-send-port': [at('<SendPort Name="SP_DynamicStatus"')],
    'unmapped-adapter': [at('<SendPort Name="SP_Telex"')],
    orchestration: [at('<Service Name="Quillmoor.Orders.Processes.ApproveOrder"')],
    'disabled-receive-location': [at('<ReceiveLocation Name="RL_Orders_File_Old">')]
  });
  assert.deepEqual(report.artifacts.map((a) => a.kind), ['orchestration', ...Array(8).fill('send-port'), ...Array(4).fill('receive-location'), 'party']);
  assert.deepEqual(report.summary.adapters.find((a) => a.adapter === 'Quillmoor.Telex'), { adapter: 'Quillmoor.Telex', artifacts: 1, target: null });
});

test('examples: the same files written with CRLF line ends give the same output', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'biztalk-binding-inventory-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const walk = async (sub) => {
      for (const e of await readdir(resolve(dir, sub), { withFileTypes: true })) {
        const rel = `${sub}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== 'output') await walk(rel);
        } else if (!e.name.endsWith('.md')) {
          const text = (await readFile(resolve(dir, rel), 'utf8')).split('\r\n').join('\n');
          await writeFile(resolve(dir, rel), text.split('\n').join('\r\n'));
        }
      }
    };
    await walk('examples');
    assert.equal((await run([...MESSY, '--explain'], dir)).out, await saved('messy-explain.txt'));
    assert.equal((await run(CLEAN, dir)).out, await saved('clean.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
