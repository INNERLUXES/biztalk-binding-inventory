import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CSV_COLUMNS, MASK, NOTICE, USAGE, VERSION, csvField, escapeData, escapeProperty, kindLabel, parseArgs, toCsv, toGithub, toJson, toText } from '../src/index.js';
import { RP, SP, bindingXml, checkOf, cli, columnOf, lineOf, reportOf, run, withFiles } from './helpers.js';

const CLEAN = { 'b.xml': bindingXml({ sendPorts: [SP()], receivePorts: [RP()] }) };
const WARN = { 'b.xml': bindingXml({ sendPorts: [SP({ filter: [] })] }) };
const ERROR = { 'b.xml': bindingXml({ sendPorts: [SP({ props: { Password: 'pw-cli' } })] }) };
const BROKEN = { 'b.xml': '<BindingInfo>\n  <SendPortCollection>\n</BindingInfo>\n' };
const ARGS = ['b.xml'];

test('cli: exit 0 below the fail-on level, 1 at or above it, from the flag or the configuration', async () => {
  const clean = await run(CLEAN, ARGS);
  assert.equal(clean.code, 0, clean.err);
  assert.match(clean.out, /^biztalk-binding-inventory: b\.xml\ninput: 1 binding file: 1 read \(1 UTF-8\), 0 not read\nconfig: built-in defaults: 22 adapters with a target; minimum severity info; fail on error\nrules: unmapped-adapter \(warning\); /);
  assert.match(clean.out, /\nartifacts: 2 in 1 application: 1 receive location, 1 send port, 0 orchestrations, 0 parties; complexity 3 \(2 low, 0 medium, 0 high\)\nfindings: 0\n/);
  assert.match(clean.out, /RESULT: PASS - no finding at or above error\n$/);
  assert.equal(clean.err, '');
  const warn = await run(WARN, ARGS);
  assert.equal(warn.code, 0, 'a warning does not fail the run by default');
  assert.equal((await run(WARN, [...ARGS, '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(CLEAN, [...ARGS, '--fail-on', 'info'])).code, 0, 'nothing at all to report');
  const configured = await run({ ...WARN, 'c.json': '{"failOn": "warning"}' }, [...ARGS, '--config', 'c.json']);
  assert.equal(configured.code, 1);
  assert.match(configured.out, /RESULT: FAIL - 1 finding at or above warning \(1 warning\)\n$/);
  assert.equal((await run({ ...WARN, 'c.json': '{"failOn": "warning"}' }, [...ARGS, '--config', 'c.json', '--fail-on', 'error'])).code, 0, 'the flag wins over the configuration');
  const error = await run(ERROR, ARGS);
  assert.equal(error.code, 1);
  assert.ok(!error.out.includes('pw-cli'));
  assert.match(error.out, /RESULT: FAIL - 1 finding at or above error \(1 error\)\n$/);
  const broken = await run(BROKEN, ARGS);
  assert.equal(broken.code, 1, 'a file that cannot be parsed fails the run at the default level');
  assert.match(broken.out, /ERROR {4}unparsable-file +b\.xml:3\n {11}line 3, column 1: the end tag <\/BindingInfo> where <\/SendPortCollection> was expected; nothing in the file is read/);
});

test('cli: --min-severity hides the findings below it and a note counts them', async () => {
  const r = await run(WARN, [...ARGS, '--min-severity', 'error']);
  assert.equal(r.code, 0);
  assert.match(r.out, /findings: 0; 1 below error not shown/);
  assert.match(r.out, /note: 1 finding below error is not shown/);
  assert.match(r.out, /findings: none\n/, 'the artifact lists only the findings shown');
});

test('cli: several files and folders are read together, a folder one level deep, and what is left out is named', async () => {
  const files = { 'a.xml': CLEAN['b.xml'], 'dir/b.xml': bindingXml({ application: 'Shop', sendPorts: [SP({ name: 'S2', address: 'C:\\other', application: '' })] }), 'dir/c.XML': bindingXml({ application: 'Shop', sendPorts: [SP({ name: 'S3', address: 'C:\\third', application: 'Shop' })] }), 'dir/readme.md': '#', 'dir/sub/d.xml': '<x/>' };
  const r = await run(files, ['a.xml', 'dir', '--json']);
  assert.equal(r.code, 0, r.err);
  const out = JSON.parse(r.out);
  assert.deepEqual(out.input.paths, ['a.xml', 'dir/b.xml', 'dir/c.XML']);
  assert.deepEqual(out.input.folders, [{ folder: 'dir', files: 2, skipped: 1, subfolders: 1 }]);
  assert.deepEqual(out.input.files.map((f) => [f.file, f.read, f.encoding, f.artifacts]), [['a.xml', true, 'utf-8', 2], ['dir/b.xml', true, 'utf-8', 1], ['dir/c.XML', true, 'utf-8', 1]]);
  assert.deepEqual(out.summary.applications.map((a) => a.application), ['App', 'Shop']);
  assert.deepEqual(out.notes, ['dir: 1 file whose name does not end in .xml was not read: "readme.md"', 'dir: 1 folder inside it was not walked; name it to read it']);
  const text = await run(files, ['dir']);
  assert.match(text.out, /^biztalk-binding-inventory: dir\/b\.xml and dir\/c\.XML\ninput: 2 binding files from 1 folder \(dir\): 2 read \(2 UTF-8\), 0 not read\n/);
  const empty = await run({ 'e/x.txt': 'x' }, ['e']);
  assert.equal(empty.code, 0);
  assert.match(empty.out, /input: 0 binding files from 1 folder \(e\): 0 read, 0 not read/);
  assert.match(empty.out, /biztalk-binding-inventory: no binding file\n/);
  const nothing = await run({ 'n.xml': '<BindingInfo />' }, ['n.xml']);
  assert.match(nothing.out, /note: no receive location, send port, orchestration or party was found in the binding files/);
  assert.match(nothing.out, /Applications \(0\)\n\n {2}none\n\nAdapters \(0\)\n\n {2}none\n\nTargets \(0\)\n\n {2}none\n\nArtifacts \(0\)\n\n {2}none\n/);
});

test('cli: UTF-16 files with a byte order mark are read, little and big endian', async () => {
  const text = CLEAN['b.xml'].replace('encoding="utf-8"', 'encoding="utf-16"');
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
  const be = Buffer.from(le);
  for (let i = 0; i < be.length; i += 2) [be[i], be[i + 1]] = [le[i + 1], le[i]];
  const r = await run({ 'le.xml': le, 'be.xml': be, 'u8.xml': text }, ['le.xml', 'be.xml', 'u8.xml', '--json']);
  const out = JSON.parse(r.out);
  assert.deepEqual(out.input.files.map((f) => f.encoding), ['utf-16le', 'utf-16be', 'utf-8']);
  assert.equal(out.artifacts.length, 6);
  const t = await run({ 'le.xml': le, 'u8.xml': text }, ['le.xml', 'u8.xml']);
  assert.match(t.out, /input: 2 binding files: 2 read \(1 UTF-8, 1 UTF-16 LE\), 0 not read/);
  const b = await run({ 'be.xml': be }, ['be.xml']);
  assert.match(b.out, /\(1 UTF-16 BE\)/);
});

test('cli: exit 2 for usage errors, with the usage and nothing on standard output', async () => {
  for (const [args, message] of [
    [[], /give the binding files to read: one or more \.xml files or folders/],
    [['b.xml', 'b.xml'], /b\.xml is named twice/],
    [['b.xml', '--bogus'], /unknown argument --bogus/],
    [['b.xml', '--format', 'xml'], /unknown format xml \(text, json, csv or github\)/],
    [['b.xml', '--format', 'json', '--format', 'text'], /--format was given twice/],
    [['b.xml', '--json', '--format', 'csv'], /--json and --format csv ask for two formats; give one/],
    [['b.xml', '--min-severity', 'notice'], /--min-severity: unknown level notice \(info, warning, error\)/],
    [['b.xml', '--fail-on', 'fatal'], /--fail-on: unknown level fatal/],
    [['b.xml', '--fail-on', 'error', '--fail-on', 'info'], /--fail-on was given twice/],
    [['b.xml', '--config'], /--config needs a value/],
    [['b.xml', '--config', '--json'], /--config needs a value/],
    [['b.xml', '--explain', '--format', 'github'], /--explain adds the sources of each finding to the text and JSON reports; the github format has no place for them/],
    [['b.xml', '--explain', '--format', 'csv'], /the csv format has no place for them/],
    [['-'], /reading from standard input is not supported/],
    [['b.xml', '--config', '-'], /reading from standard input is not supported/],
    [['https://example.test/b.xml'], /give a local path; the tool never fetches a URL/],
    [['b.xml', '--config', 'file://c.json'], /give a local path/]
  ]) {
    const r = await run(CLEAN, args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, message, args.join(' '));
    assert.ok(r.err.includes('Usage: biztalk-binding-inventory'), args.join(' '));
    assert.equal(r.out, '');
  }
  assert.throws(() => parseArgs(Array.from({ length: 101 }, (_, i) => `p${i}.xml`)), /more than 100 files or folders/);
});

test('cli: exit 2 for input errors, with the problems and no result', async () => {
  for (const [files, args, message] of [
    [CLEAN, ['missing.xml'], /missing\.xml: no such file or folder/],
    [{ 'f.txt': 'x' }, ['f.txt'], /f\.txt: not a kind of file the tool reads \(a binding file whose name ends in \.xml, or a folder of them\)/],
    [{ '.xml': 'x' }, ['.xml'], /\.xml: not a kind of file the tool reads/],
    [CLEAN, ['b.xml', './b.xml'], /b\.xml: is named twice/],
    [{ 'd/b.xml': '<BindingInfo/>' }, ['d', 'd/b.xml'], /d\/b\.xml: is named twice/],
    [{ ...CLEAN, 'c.json': '{"failOm": "info"}' }, ['b.xml', '--config', 'c.json'], /c\.json: line 1: "failOm" is not a key of the configuration; did you mean "failOn"\?/],
    [CLEAN, ['b.xml', '--config', 'nope.json'], /nope\.json: no such file/],
    [{ ...CLEAN, 'd/c.json': '{}' }, ['b.xml', '--config', 'd'], /d: is a folder; give the file itself/]
  ]) {
    const r = await run(files, args);
    assert.equal(r.code, 2, `${args.join(' ')}: ${r.err}`);
    assert.match(r.err, /^biztalk-binding-inventory: no result, the input has (?:a problem|problems):\n/);
    assert.match(r.err, message);
    assert.equal(r.out, '');
  }
});

test('cli: a binary or invalid file, or one over its limit, is an error finding, and the rest is still read', async () => {
  const r = await run({ ...WARN, 'j.xml': Buffer.from([0x3c, 0, 0x64]), 'l.xml': Buffer.from([0x3c, 0xe9, 0x0a]), 'k.xml': Buffer.from([0xff, 0xfe, 0x3c]) }, ['b.xml', 'j.xml', 'l.xml', 'k.xml']);
  assert.equal(r.code, 1);
  assert.match(r.out, /j\.xml:1\n {11}the file cannot be read: holds binary data \(a null byte\); a UTF-16 file needs its byte order mark; export the bindings again; nothing in it is checked/);
  assert.match(r.out, /l\.xml:1\n {11}the file cannot be read: is not valid UTF-8/);
  assert.match(r.out, /k\.xml:1\n {11}the file cannot be read: is not valid UTF-16/);
  assert.match(r.out, /input: 4 binding files: 1 read \(1 UTF-8\), 3 not read/);
  assert.match(r.out, /the send port "SP1" has no filter/);
  const big = await run(CLEAN, ARGS, { maxFileBytes: 10 });
  assert.match(big.out, /b\.xml:1\n {11}the file cannot be read: [\d,]+ bytes is over the 10 byte limit/);
  const one = CLEAN['b.xml'].length;
  const total = await run({ 'x.xml': CLEAN['b.xml'], 'y.xml': CLEAN['b.xml'] }, ['x.xml', 'y.xml'], { maxTotalBytes: one });
  assert.equal(total.code, 2);
  assert.match(total.err, /y\.xml: the files read so far hold more than [\d,]+ bytes, the limit of one run/);
  const deep = await run(CLEAN, ARGS, { maxDepth: 3 });
  assert.match(deep.out, /elements nested more than 3 deep; nothing in the file is read/);
});

test('cli: --help, --version and --print-defaults', async () => {
  const help = await cli(['--help'], '.');
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const s of ['--config', '--fail-on', '--min-severity', '--format', 'github', 'csv', 'orphan-send-port (rules.orphanSendPort)', 'unparsable-file (always error)', 'DOCTYPE', 'Exit codes: 0 no finding at or above the fail-on level']) assert.ok(USAGE.includes(s), s);
  const version = await cli(['--version'], '.');
  assert.equal(version.out, `${VERSION}\n`);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  const defaults = await cli(['--print-defaults'], '.');
  assert.equal(defaults.code, 0);
  assert.deepEqual(Object.keys(JSON.parse(defaults.out)), ['name', 'rules', 'adapterTargets', 'builtInPrefixes', 'secretNames', 'weights', 'minSeverity', 'failOn']);
  assert.equal(JSON.parse(defaults.out).adapterTargets['WCF-SQL'], 'Logic Apps SQL Server connector');
});

test('text: the summaries, each artifact with its fields, the findings with the fix, and --explain', () => {
  const r = checkOf({ orchestrations: [{ name: 'O', host: 'H', ports: [{ name: 'a', sendPort: 'S' }, { name: 'b', receivePort: 'RP1' }, { name: 'c', sendPortGroup: 'G' }, { name: 'd' }] }], sendPorts: [SP({ name: 'S', filter: [], maps: ['M1', 'M2'], twoWay: true, backup: { adapter: 'FTP', address: 'ftp://h/' }, address: 'ftp://u:pw-text@h/x' }), SP({ name: 'D', dynamic: true })], receivePorts: [RP({ enabled: false, pipeline: 'Contoso.In', data: '<Root><Component Name="Contoso.C" /></Root>' })], parties: [{ name: 'P', sendPorts: [] }] });
  const out = toText(r);
  assert.ok(out.includes('Applications (1)\n\n  application  receive locations  send ports  orchestrations  complexity\n  App          1                  2           1               '));
  assert.ok(out.includes('  orchestration  O (App)  b.xml:'));
  assert.ok(out.includes('           ports: a -> send port S; b -> receive port RP1; c -> send port group G; d -> not bound\n'));
  assert.ok(out.includes(`           address: ftp://u:${MASK}@h/x\n`));
  assert.ok(out.includes('           backup adapter: FTP\n'));
  assert.ok(out.includes('           two-way: yes\n'));
  assert.ok(out.includes('           maps: M1, M2\n'));
  assert.ok(out.includes('           filter: none\n'));
  assert.ok(out.includes('           adapter: dynamic (set at run time)\n'));
  assert.ok(out.includes('           enabled: no\n'));
  assert.ok(out.includes('           pipelines: receive Contoso.In (custom; custom component Contoso.C)\n'));
  assert.ok(out.includes('  party  P  b.xml:'));
  assert.ok(out.includes('           send ports: none\n'));
  assert.match(out, /\n {2}ERROR {4}plain-text-credential {6}b\.xml:\d+\n {11}the send port "S" holds the password/);
  assert.ok(out.includes(NOTICE));
  assert.ok(!out.includes('basis:'));
  assert.ok(!out.includes('pw-text'));
  const explained = toText(r, { explain: true });
  assert.match(explained, /\n {11}rule: a value in a setting named like a password, secret, key or token, a password in an address, or a secret in a connection string\n {11}basis: BizTalk Server takes the passwords out of a binding file when it exports one.+ \(Exporting Bindings \(Microsoft Learn, BizTalk Server\), https:\/\/learn\.microsoft\.com\/en-us\/biztalk\/core\/exporting-bindings6\)\n/);
  assert.match(explained, /the tool's own choice: an element or attribute whose name is that of a secret/);
  assert.match(explained, /complexity: 5 \(medium: sendPort 1, map 1 x 2, twoWay 1, backupTransport 1\)/);
  assert.equal(kindLabel('send-port'), 'send port');
  assert.equal(kindLabel(''), 'file');
});

test('json: the whole report, without the sources and the parts of the scores unless --explain', () => {
  const r = checkOf({ sendPorts: [SP({ filter: [] })] });
  const out = JSON.parse(toJson(r));
  assert.deepEqual(Object.keys(out), ['tool', 'version', 'input', 'config', 'summary', 'artifacts', 'findings', 'totals', 'result', 'notes', 'notice']);
  assert.deepEqual(Object.keys(out.findings[0]), ['rule', 'level', 'file', 'line', 'column', 'at', 'kind', 'artifact', 'artifactAt', 'found', 'fix']);
  assert.deepEqual(Object.keys(out.summary), ['applications', 'adapters', 'targets', 'totals']);
  assert.deepEqual(Object.keys(out.artifacts[0]), ['kind', 'name', 'application', 'file', 'line', 'column', 'at', 'adapter', 'backupAdapter', 'address', 'port', 'enabled', 'dynamic', 'twoWay', 'pipelines', 'maps', 'filters', 'ports', 'host', 'sendPorts', 'targets', 'target', 'complexity', 'band', 'findings']);
  const explained = JSON.parse(toJson(r, { explain: true }));
  assert.ok(explained.findings[0].basis.length > 0);
  assert.deepEqual(explained.artifacts[0].complexityParts, ['sendPort 1']);
  assert.deepEqual(out.result, { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 1, info: 0 }, text: 'PASS - no finding at or above error (1 warning)' });
  assert.equal(out.tool, 'biztalk-binding-inventory');
});

test('csv: one row per artifact with the masked address, and a row per file for findings that belong to no artifact', () => {
  const r = reportOf({ 'a.xml': bindingXml({ sendPorts: [SP({ name: '=cmd', address: 'ftp://u:pw-csv@h/x', backup: { adapter: 'FTP', address: 'y' } }), SP({ name: 'D', dynamic: true })], extra: '<X Token="t" />' }), 'b.xml': '<Nope/>' });
  const rows = toCsv(r).split('\r\n');
  assert.equal(rows[0], CSV_COLUMNS.join(','));
  assert.equal(rows[0], 'kind,name,application,adapter,address,target,complexity,findings');
  assert.equal(rows[1], `send-port,'=cmd,App,FILE; backup FTP,ftp://u:${MASK}@h/x,Logic Apps File System connector or Azure Blob Storage + Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP),3,error plain-text-credential`);
  assert.match(rows[2], /^send-port,D,App,dynamic,,Logic Apps Standard workflow that picks the connector/);
  assert.equal(rows[3], 'file,a.xml,,,,,,error plain-text-credential');
  assert.equal(rows[4], 'file,b.xml,,,,,,error unparsable-file');
  assert.equal(rows[5], '');
  assert.ok(!toCsv(r).includes('pw-csv'));
  assert.equal(csvField('a,"b"'), '"a,""b"""');
  assert.equal(csvField('@x'), "'@x");
  assert.equal(csvField(null), '');
  assert.equal(csvField(3), '3');
});

test('github: one workflow command per finding, with its properties and message escaped, then a summary line', () => {
  const text = bindingXml({ sendPorts: [SP({ name: '100%\n::error', filter: [] })] });
  const r = reportOf({ 'a,b:c.xml': text });
  const lines = toGithub(r).trimEnd().split('\n');
  assert.equal(lines.length, 2, 'the line break in the name starts no command');
  assert.equal(lines[0], `::warning file=a%2Cb%3Ac.xml,line=${lineOf(text, '<SendPort ')},col=${columnOf(text, '<SendPort ')},title=biztalk-binding-inventory orphan-send-port::the send port "100%25 ::error" has no filter, no orchestration port names it and it is in no send port group with a filter, so it receives no message; fix: remove the send port if it is not used, or name the subscription it serves so the move can route it, such as a Service Bus subscription`);
  assert.equal(lines[1], 'biztalk-binding-inventory: 1 artifact in 1 application, 1 finding; RESULT: PASS - no finding at or above error (1 warning)');
  assert.match(toGithub(checkOf({ orchestrations: [{ name: 'O' }] })), /^::notice file=b\.xml,line=\d+,col=\d+,title=biztalk-binding-inventory orchestration::/);
  assert.match(toGithub(checkOf({ sendPorts: [SP({ props: { Password: 'x' } })] })), /^::error file=b\.xml,line=\d+,col=\d+,title=biztalk-binding-inventory plain-text-credential::/);
  assert.equal(escapeData('a%\r\nb'), 'a%25%0D%0Ab');
  assert.equal(escapeProperty('a:b,c'), 'a%3Ab%2Cc');
});

test('cli: a run writes nothing to disk', async () => {
  await withFiles(WARN, async (dir) => {
    const before = await readdir(resolve(dir), { recursive: true });
    for (const format of ['text', 'json', 'csv', 'github']) assert.equal((await cli([...ARGS, '--format', format], dir)).code, 0);
    assert.deepEqual(await readdir(resolve(dir), { recursive: true }), before);
  });
});
