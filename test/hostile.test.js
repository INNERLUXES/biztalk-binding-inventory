import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FILE_LIMITS, LIMITS, MAX_PROBLEMS, XmlError, isSecretName, maskText, parseXml } from '../src/index.js';
import { RP, SP, bindingXml, cli, esc, reportOf, run, withFiles } from './helpers.js';

// Hostile input: files built to read other files through entities, to expand without bound, to exhaust the memory or
// the time, to make the tool follow a link, to rewrite the terminal, to start a second workflow command, to slip a
// formula into a spreadsheet, to leak a password or to change how objects behave. Each heavy test also checks the time,
// because work that grows faster than the input is a failure even when the answer is right. Tests that need a symbolic
// link, a device or file permissions are guarded with process.platform, and none of them asserts a line: lines are
// asserted in the tests that run everywhere.

const LIMIT = { timeout: 180000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};

const GOOD = { 'b.xml': bindingXml({ sendPorts: [SP()], receivePorts: [RP()] }) };

test('hostile: external entities and entity expansion are refused before anything is read or expanded', LIMIT, async () => {
  const xxe = '<?xml version="1.0"?>\n<!DOCTYPE BindingInfo [\n  <!ENTITY secret SYSTEM "file:///etc/passwd">\n]>\n<BindingInfo><SendPortCollection><SendPort Name="&secret;" /></SendPortCollection></BindingInfo>\n';
  const lol = `<?xml version="1.0"?>\n<!DOCTYPE lolz [<!ENTITY lol "lol">${Array.from({ length: 9 }, (_, i) => `<!ENTITY lol${i + 1} "${`&lol${i || ''};`.repeat(10)}">`).join('')}]>\n<BindingInfo>&lol9;</BindingInfo>\n`;
  const internal = '<BindingInfo><!ENTITY a "b"></BindingInfo>';
  const r = await fast(() => run({ 'xxe.xml': xxe, 'lol.xml': lol, 'internal.xml': internal, 'param.xml': '<BindingInfo>%pe;&pe;</BindingInfo>' }, ['xxe.xml', 'lol.xml', 'internal.xml', 'param.xml', '--json']));
  assert.equal(r.code, 1);
  const out = JSON.parse(r.out);
  assert.deepEqual(out.findings.map((f) => [f.file, f.rule, f.line]), [['xxe.xml', 'unparsable-file', 2], ['lol.xml', 'unparsable-file', 2], ['internal.xml', 'unparsable-file', 1], ['param.xml', 'unparsable-file', 1]]);
  assert.ok(out.findings.slice(0, 2).every((f) => f.found.includes('a DOCTYPE declaration; the tool reads no document type definition')));
  assert.match(out.findings[2].found, /an ENTITY declaration/);
  assert.match(out.findings[3].found, /the entity reference &pe; is not one XML predefines/);
  assert.ok(!r.out.includes('root:'), 'no file was read through an entity');
  assert.equal(out.artifacts.length, 0);
});

test('hostile: a file over its size limit is an error finding, a configuration over its limit stops the run', LIMIT, async () => {
  const big = await fast(() => run({ ...GOOD, 'big.xml': `<BindingInfo>${' '.repeat(FILE_LIMITS.maxFileBytes)}</BindingInfo>` }, ['b.xml', 'big.xml']));
  assert.equal(big.code, 1);
  assert.match(big.out, /big\.xml:1\n {11}the file cannot be read: [\d,]+ bytes is over the 32 MB limit; nothing in it is checked/);
  const config = await run({ ...GOOD, 'c.json': ' '.repeat(FILE_LIMITS.maxConfigBytes + 1) }, ['b.xml', '--config', 'c.json']);
  assert.equal(config.code, 2);
  assert.match(config.err, /c\.json: [\d,]+ bytes is over the 1 MB limit/);
});

test('hostile: twenty thousand send ports and receive locations, each with every check to run, are checked in seconds', LIMIT, async () => {
  const n = 10000;
  const sendPorts = Array.from({ length: n }, (_, i) => SP({ name: `S${i}`, adapter: i % 7 ? 'FILE' : `Custom${i % 50}`, address: `C:\\out\\${i % 3000}`, filter: i % 2 ? [] : [['BTS.MessageType', 0, `m${i}`]], pipeline: i % 5 ? undefined : `Contoso.P${i}`, props: i % 11 ? undefined : { Password: `pw${i}` } }));
  const receivePorts = [{ name: 'RP', locations: Array.from({ length: n }, (_, i) => ({ name: `L${i}`, address: `C:\\in\\${i % 4000}`, enabled: i % 9 !== 0 })) }];
  const text = bindingXml({ sendPorts, receivePorts, orchestrations: Array.from({ length: 200 }, (_, i) => ({ name: `O${i}`, ports: [{ name: 'p', sendPort: `S${i * 2 + 1}` }] })) });
  const r = await fast(() => reportOf({ 'big.xml': text }), 60000);
  assert.equal(r.summary.totals.artifacts, 2 * n + 200);
  assert.ok(r.totals.findings > 2 * n);
  assert.ok(r.findings.length <= LIMITS.maxFindingsPerRule * 11);
  assert.ok(r.notes.some((x) => /findings past the limit of 500 per rule are counted but not listed/.test(x)));
  assert.ok(!JSON.stringify(r).includes('pw11'));
});

test('hostile: long runs of brackets, quotes, ampersands, entities and names are read or refused in one pass', LIMIT, async () => {
  const texts = ['<'.repeat(500000), '<a>'.repeat(200000), `<a b="${'x'.repeat(500000)}"/>`, `<a>${'&amp;'.repeat(200000)}</a>`, `<a>${'&'.repeat(200000)}</a>`, `<a ${'x="1" '.repeat(300)}/>`, `<${'a'.repeat(300000)}/>`, `<a>${'<!--x-->'.repeat(100000)}</a>`, `<a>${'<![CDATA[x]]>'.repeat(100000)}</a>`, `<a>${'<b/>'.repeat(200000)}</a>`, `<a>${'</a>'.repeat(100000)}`, `${'<?pi x?>'.repeat(100000)}<a/>`, `<a>${'&#x41;'.repeat(200000)}</a>`, `<a x="${'&lt;'.repeat(200000)}"/>`];
  for (const text of texts) {
    await fast(() => {
      try {
        parseXml(text);
      } catch (error) {
        assert.ok(error instanceof XmlError, error.message);
      }
    });
  }
});

test('hostile: long values for the patterns of secrets and addresses are read in one pass', LIMIT, async () => {
  const long = (s) => s.repeat(Math.floor(200000 / s.length));
  for (const text of [long('://'), long('a://b'), long(':@'), long('://u:p@'), long('='), long('a=b;'), long('Password=;'), long('x'), long('@'), long(';'), `ftp://${long('u')}:${long('p')}@h`]) {
    await fast(() => maskText(text));
  }
  await fast(() => isSecretName(long('password')));
  const r = await fast(() => reportOf({ 'b.xml': bindingXml({ sendPorts: [SP({ address: long('a=b;'), props: { Long: long('Pwd=x;') } })] }) }));
  assert.equal(r.findings.filter((f) => f.rule === 'plain-text-credential').length, 1);
});

test('hostile: settings written as text inside settings, nested many times, are read a set number of levels deep', LIMIT, async () => {
  let inner = '<x>y</x>';
  for (let i = 0; i < 12; i += 1) inner = `<L>${esc(inner)}</L>`;
  const r = await fast(() => reportOf({ 'b.xml': bindingXml({ sendPorts: [SP({ props: { Deep: inner } })] }) }));
  assert.equal(r.findings.length, 0);
});

test('hostile: a set of a hundred files of no kind the tool reads lists twenty problems and a count', LIMIT, async () => {
  const files = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`f${String(i).padStart(3, '0')}.txt`, 'x']));
  const r = await fast(() => run(files, Object.keys(files)));
  assert.equal(r.code, 2);
  assert.match(r.err, /the input has problems:/);
  assert.match(r.err, /\n {2}and 80 more\n$/);
  assert.equal(r.err.split('\n').filter((l) => l.startsWith('  f')).length, MAX_PROBLEMS);
});

test('hostile: CRLF, CR, a byte order mark and UTF-16 give the same report as LF', async () => {
  const text = bindingXml({ sendPorts: [SP({ filter: [], props: { Password: 'pw' } })], receivePorts: [RP({ enabled: false })] });
  const lf = await run({ 'b.xml': text }, ['b.xml', '--json']);
  assert.equal(lf.code, 1, lf.err);
  assert.equal(JSON.parse(lf.out).totals.findings, 3);
  const plain = (out) => out.replace(/"encoding": "[^"]+"/, '');
  for (const eol of ['\r\n', '\r']) {
    const r = await run({ 'b.xml': `${String.fromCharCode(0xfeff)}${text.split('\n').join(eol)}` }, ['b.xml', '--json']);
    assert.equal(r.out, lf.out, JSON.stringify(eol));
  }
  const utf16 = await run({ 'b.xml': Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]) }, ['b.xml', '--json']);
  assert.equal(plain(utf16.out), plain(lf.out));
});

test('hostile: control, escape and direction characters in file names and values never reach the reports', async () => {
  const escape = String.fromCharCode(27);
  const rlo = String.fromCharCode(0x202e);
  const ls = String.fromCharCode(0x2028);
  const name = `p${rlo}.xml`;
  const files = { [name]: bindingXml({ application: `A${rlo}pp`, sendPorts: [SP({ name: `S${ls}[2J`, address: `C:\\o${ls}ut`, adapter: `F${rlo}X`, filter: [], application: `A${rlo}pp` })] }), 'esc.xml': `<BindingInfo>${escape}[2J</BindingInfo>` };
  for (const format of ['text', 'json', 'csv', 'github']) {
    const r = await run(files, [name, 'esc.xml', ...(format === 'text' ? [] : ['--format', format]), ...(format === 'text' || format === 'json' ? ['--explain'] : [])]);
    assert.equal(r.code, 1, r.err);
    assert.ok(format === 'csv' || r.out.includes('a character XML does not allow (code 27)'), format);
    for (const c of [escape, rlo, ls]) assert.ok(!r.out.includes(c) && !r.err.includes(c), `${format}: ${c.charCodeAt(0)}`);
  }
  const bad = await run({ [`bad${rlo}.txt`]: 'x' }, [`bad${rlo}.txt`]);
  assert.equal(bad.code, 2);
  assert.ok(!bad.err.includes(rlo));
});

test('hostile: a text cannot start a second workflow command', async () => {
  const r = await run({ 'b.xml': bindingXml({ sendPorts: [SP({ name: '%0A::error::x\n::error file=x::y', filter: [] })] }) }, ['b.xml', '--format', 'github']);
  const lines = r.out.trimEnd().split('\n');
  assert.ok(lines.every((l) => l.startsWith('::error ') || l.startsWith('::warning ') || l.startsWith('::notice ') || l.startsWith('biztalk-binding-inventory: ')), r.out);
  assert.ok(r.out.includes('%250A::error::x'));
  assert.equal(lines.length, 2, 'one finding and the summary line');
});

test('hostile: a value that starts with a formula character is not a formula in the CSV inventory', async () => {
  const r = await run({ 'b.xml': bindingXml({ application: '+App', sendPorts: [SP({ name: '=HYPERLINK("x")', adapter: '@FILE', address: '-C:\\x', application: '+App' })] }) }, ['b.xml', '--format', 'csv']);
  assert.equal(r.code, 0, r.err);
  const row = r.out.split('\r\n')[1];
  assert.ok(row.startsWith(`send-port,"'=HYPERLINK(""x"")",'+App,'@FILE,'-C:\\x,`), row);
});

test('hostile: a password is never shown, in any format, wherever it is written', async () => {
  const secrets = ['pw-attr', 'pw-elem', 'pw-conn', 'pw-url', 'pw-filter', 'pw-pipe', 'pw-party'];
  const text = bindingXml({
    sendPorts: [SP({ address: 'ftp://u:pw-url@h/x', props: { Password: 'pw-elem', ConnectionString: 'Server=h;Password=pw-conn' }, filter: [['A.Secret', 0, 'pw-filter']], data: '<Root><Component Name="Microsoft.BizTalk.Component.X"><Properties><SigningKey vt="8">pw-pipe</SigningKey></Properties></Component></Root>' })],
    parties: [{ name: 'P' }],
    extra: '<Extra ClientSecret="pw-attr"><PartyPassword>pw-party</PartyPassword></Extra>'
  });
  for (const format of ['text', 'json', 'csv', 'github']) {
    const r = await run({ 'b.xml': text }, ['b.xml', ...(format === 'text' ? ['--explain'] : ['--format', format])]);
    assert.equal(r.code, 1, r.err);
    for (const s of secrets) assert.ok(!r.out.includes(s) && !r.err.includes(s), `${format}: ${s}`);
  }
  const json = JSON.parse((await run({ 'b.xml': text }, ['b.xml', '--json'])).out);
  assert.equal(json.findings.filter((f) => f.rule === 'plain-text-credential').length, 6);
});

test('hostile: constructor, toString and __proto__ as names, adapters, attributes and configuration keys are only data', async () => {
  const r = reportOf({ 'b.xml': bindingXml({ application: '__proto__', sendPorts: [SP({ name: 'constructor', adapter: 'toString', filter: [] }), SP({ name: '__proto__', adapter: '__proto__', address: 'y' })], extra: '<X __proto__="1" constructor="2" />' }) });
  assert.deepEqual(r.findings.map((f) => [f.rule, f.artifact]), [['unmapped-adapter', 'constructor'], ['orphan-send-port', 'constructor'], ['unmapped-adapter', '__proto__']]);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
  assert.equal({}.x, undefined);
  const cfg = await run({ ...GOOD, 'c.json': '{"rules": {"toString": "off"}, "adapterTargets": {"__proto__": 1}, "weights": {"constructor": 1}}' }, ['b.xml', '--config', 'c.json']);
  assert.equal(cfg.code, 2);
  assert.match(cfg.err, /"toString" is not a key of rules/);
  assert.match(cfg.err, /adapterTargets\.__proto__ must be a text/);
  assert.match(cfg.err, /"constructor" is not a key of weights/);
  const mapped = reportOf({ 'b.xml': bindingXml({ sendPorts: [SP({ adapter: '__proto__' })] }) }, JSON.parse('{"adapterTargets": {"__proto__": "Azure Functions"}}'));
  assert.deepEqual(mapped.artifacts[0].targets, ['Azure Functions']);
  assert.deepEqual(Object.keys(mapped.config.adapterTargets), ['__proto__']);
});

test('hostile: empty files and files that are not binding files are reported without a crash', async () => {
  const r = await run({ 'a.xml': '', 'b.xml': '\n\n', 'c.xml': '<?xml version="1.0"?>', 'd.xml': '<html><body/></html>' }, ['a.xml', 'b.xml', 'c.xml', 'd.xml']);
  assert.equal(r.code, 1, r.err);
  assert.match(r.out, /input: 4 binding files: 0 read, 4 not read/);
  assert.equal((r.out.match(/no root element; the text holds no XML element; nothing in the file is read/g) ?? []).length, 3);
  assert.match(r.out, /the root element is <html>, not <BindingInfo>/);
});

test('hostile: a file or folder named through a symbolic link is refused, a link inside a folder is a finding, and so is a configuration', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows needs extra rights to make a symbolic link');
    return;
  }
  await withFiles({ 'real/b.xml': GOOD['b.xml'], 'c.json': '{}', 'other/x.xml': GOOD['b.xml'] }, async (dir) => {
    await symlink(resolve(dir, 'real/b.xml'), resolve(dir, 'linked.xml'));
    await symlink(resolve(dir, 'c.json'), resolve(dir, 'c-link.json'));
    await symlink(resolve(dir, 'real'), resolve(dir, 'via'));
    await mkdir(resolve(dir, 'mixed'));
    await symlink(resolve(dir, 'other/x.xml'), resolve(dir, 'mixed/inside.xml'));
    const r = await cli(['linked.xml'], dir);
    assert.equal(r.code, 2);
    assert.match(r.err, /linked\.xml: is a symbolic link, which is not followed/);
    const c = await cli(['real/b.xml', '--config', 'c-link.json'], dir);
    assert.equal(c.code, 2);
    assert.match(c.err, /c-link\.json: is a symbolic link/);
    const d = await cli(['via'], dir);
    assert.equal(d.code, 2);
    assert.match(d.err, /via: is a symbolic link, which is not followed/);
    const m = await cli(['mixed'], dir);
    assert.equal(m.code, 1);
    assert.match(m.out, /the file cannot be read: is a symbolic link, which is not followed; nothing in it is checked/);
  });
});

test('hostile: a device named as a binding file or the configuration is refused', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows has no /dev/zero to name as an input');
    return;
  }
  await withFiles(GOOD, async (dir) => {
    const config = await fast(() => cli(['b.xml', '--config', '/dev/zero'], dir));
    assert.equal(config.code, 2);
    assert.match(config.err, /is not a regular file/);
    const input = await fast(() => cli(['/dev/zero'], dir));
    assert.equal(input.code, 2);
    assert.match(input.err, /is not a regular file or folder/);
  });
});

test('hostile: a file without read access is an error finding, and the rest is still checked', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows does not take away read access with chmod');
    return;
  }
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('the root user can read a file without read access');
    return;
  }
  await withFiles({ ...GOOD, 'n.xml': GOOD['b.xml'] }, async (dir) => {
    await chmod(resolve(dir, 'n.xml'), 0o000);
    try {
      const r = await cli(['b.xml', 'n.xml'], dir);
      assert.equal(r.code, 1);
      assert.match(r.out, /the file cannot be read: cannot be read \(EACCES\)/);
      assert.match(r.out, /artifacts: 2 in 1 application/);
    } finally {
      await chmod(resolve(dir, 'n.xml'), 0o644);
    }
  });
});
