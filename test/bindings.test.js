import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARTIFACT_KINDS, BINDING_LIMITS, KIND_LABELS, MASK, OPERATORS, addressOf, defaultConfig, filterOf, parseXml, readBinding, startsWithAny, unreadableBinding } from '../src/index.js';
import { RP, SP, bindingXml, esc, filterXml, lineOf, propsXml } from './helpers.js';

// One binding file read into artifacts: the receive locations, send ports, orchestrations and parties with their
// adapters, masked addresses, pipelines, maps and filters, and the problems found inside the file.

const cfg = defaultConfig();
const read = (parts) => readBinding(bindingXml(parts), 'b.xml', cfg);
const byName = (r, name) => r.artifacts.find((a) => a.name === name);

test('bindings: every kind of artifact with its fields, at the line of its element', () => {
  const text = bindingXml({
    application: 'Orders',
    orchestrations: [{ name: 'Orders.Approve', host: 'Proc', ports: [{ name: 'In', receivePort: 'RP1' }, { name: 'Out', sendPort: 'SP1' }, { name: 'Many', sendPortGroup: 'G1' }] }],
    sendPorts: [SP({ maps: ['Orders.Maps.A'], twoWay: true, backup: { adapter: 'FTP', address: 'ftp://h/x' } })],
    receivePorts: [RP({ enabled: false }, { twoWay: true, maps: ['Orders.Maps.In'] })],
    groups: [{ name: 'G1', filter: [['BTS.MessageType', 0, 'x']], sendPorts: ['SP1'] }],
    parties: [{ name: 'Partner One', sendPorts: ['SP1'], aliases: ['Org', 'DUNS'] }]
  });
  const r = readBinding(text, 'b.xml', cfg);
  assert.equal(r.read, true);
  assert.equal(r.application, 'Orders');
  assert.deepEqual(r.artifacts.map((a) => [a.kind, a.name, a.line]), [['orchestration', 'Orders.Approve', lineOf(text, '<Service ')], ['send-port', 'SP1', lineOf(text, '<SendPort ')], ['receive-location', 'RL1', lineOf(text, '<ReceiveLocation ')], ['party', 'Partner One', lineOf(text, '<Party ')]]);
  const o = byName(r, 'Orders.Approve');
  assert.equal(o.application, 'Orders');
  assert.equal(o.host, 'Proc');
  assert.deepEqual(o.ports, [{ name: 'In', sendPort: '', receivePort: 'RP1', sendPortGroup: '' }, { name: 'Out', sendPort: 'SP1', receivePort: '', sendPortGroup: '' }, { name: 'Many', sendPort: '', receivePort: '', sendPortGroup: 'G1' }]);
  const s = byName(r, 'SP1');
  assert.deepEqual([s.adapter, s.address, s.backupAdapter, s.dynamic, s.twoWay, s.application], ['FILE', 'C:\\out\\%MessageID%.xml', 'FTP', false, true, 'App']);
  assert.deepEqual(s.pipelines.map((p) => [p.role, p.name, p.custom]), [['send', 'Microsoft.BizTalk.DefaultPipelines.XMLTransmit', false], ['receive', 'Microsoft.BizTalk.DefaultPipelines.XMLReceive', false]]);
  assert.deepEqual(s.maps, ['Orders.Maps.A']);
  assert.deepEqual(s.filters, ['BTS.ReceivePortName == RP1']);
  assert.equal(s.filterStatements, 1);
  const l = byName(r, 'RL1');
  assert.deepEqual([l.adapter, l.address, l.port, l.enabled, l.twoWay, l.maps], ['FILE', 'C:\\in\\*.xml', 'RP1', false, true, ['Orders.Maps.In']]);
  assert.deepEqual(l.pipelines.map((p) => p.role), ['receive', 'send']);
  const p = byName(r, 'Partner One');
  assert.deepEqual([p.sendPorts, p.aliases, p.application], [['SP1'], 2, '']);
  assert.deepEqual(r.groups, [{ name: 'G1', statements: 1, sendPorts: ['SP1'] }]);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(ARTIFACT_KINDS, Object.keys(KIND_LABELS));
});

test('bindings: an application from the ports when no module names one, and from the module when a port names none', () => {
  const text = bindingXml({ sendPorts: [SP({ application: '' })] }).replace('[Application:App]', 'Orders.Schemas');
  assert.equal(readBinding(text, 'b.xml', cfg).artifacts[0].application, '');
  assert.equal(read({ application: 'Shop', sendPorts: [SP({ application: '' })] }).artifacts[0].application, 'Shop');
});

test('bindings: the filters, with every operator, several groups and a masked value', () => {
  const one = filterOf(parseXml(`<Filter>${esc(filterXml([['A.B', 0, 'x'], ['A.C', 5, 'y'], ['A.D', 6], ['A.ApiKey', 0, 'k1'], ['A.E', 9, 'z']]))}</Filter>`), cfg);
  assert.deepEqual(one, { groups: [`A.B == x AND A.C != y AND A.D exists AND A.ApiKey == ${MASK} AND A.E operator 9 z`], statements: 5, problem: null });
  const two = filterOf(parseXml(`<Filter>${esc('<Filter><Group><Statement Property="P" Operator="1" Value="1" /></Group><Group><Statement Property="Q" Operator="4" Value="Password=x" /></Group><Group /></Filter>')}</Filter>`), cfg);
  assert.deepEqual(two.groups, ['P < 1', `Q >= Password=${MASK}`]);
  assert.deepEqual(filterOf(null, cfg), { groups: [], statements: 0, problem: null });
  assert.deepEqual(filterOf(parseXml('<Filter />'), cfg), { groups: [], statements: 0, problem: null });
  assert.match(filterOf(parseXml('<Filter>&lt;Filter&gt;</Filter>'), cfg).problem, /the element <Filter> is not closed/);
  assert.deepEqual(Object.values(OPERATORS), ['==', '<', '<=', '>', '>=', '!=', 'exists']);
});

test('bindings: custom pipelines and custom components in the pipeline settings; built-in ones and EDI pipelines are told apart', () => {
  const data = '<Root><Stages><Stage><Components><Component Name="Contoso.Zip" /><Component Name="Microsoft.BizTalk.Component.XmlAsmComp" /><Component Name="Contoso.Zip" /></Components></Stage></Stages></Root>';
  const r = read({ sendPorts: [SP({ name: 'A', pipeline: 'Contoso.Pipelines.Zip', data }), SP({ name: 'B', pipeline: 'microsoft.biztalk.defaultpipelines.xmltransmit' }), SP({ name: 'C', pipeline: 'Microsoft.BizTalk.Edi.DefaultPipelines.EdiSend' })] });
  assert.deepEqual(byName(r, 'A').pipelines[0], { role: 'send', name: 'Contoso.Pipelines.Zip', custom: true, b2b: false, components: ['Contoso.Zip'] });
  assert.equal(byName(r, 'B').pipelines[0].custom, false, 'the prefixes are compared with A to Z lowered');
  assert.deepEqual([byName(r, 'C').pipelines[0].custom, byName(r, 'C').pipelines[0].b2b], [false, true]);
  const shared = readBinding(bindingXml({ sendPorts: [SP({ pipeline: 'Contoso.Shared.Zip' })] }), 'b.xml', { ...cfg, builtInPrefixes: [...cfg.builtInPrefixes, 'Contoso.Shared.'] });
  assert.equal(shared.artifacts[0].pipelines[0].custom, false, 'a prefix of the configuration is built in');
  assert.equal(startsWithAny('ABC.d', ['abc.']), true);
  assert.equal(startsWithAny('ab', ['abc']), false);
});

test('bindings: addresses are masked when read and compared in one form', () => {
  assert.deepEqual(addressOf('ftp://u:p@H/In/', cfg), { address: `ftp://u:${MASK}@H/In/`, key: `ftp://u:${MASK}@h/in` });
  assert.deepEqual(addressOf('C:\\In\\', cfg), { address: 'C:\\In\\', key: 'c:/in' });
  assert.deepEqual(addressOf('', cfg), { address: '', key: '' });
  const r = read({ sendPorts: [SP({ address: 'ftp://u:secret-value@h/x' })] });
  assert.equal(r.artifacts[0].address, `ftp://u:${MASK}@h/x`);
  assert.ok(!JSON.stringify(r).includes('secret-value'));
});

test('bindings: credentials in plain text anywhere in the file are found, and none of their values is kept', () => {
  const text = bindingXml({
    sendPorts: [SP({ name: 'S1', props: { UserName: 'u', Password: 'pw-one', ServerAddress: 'h' } }), SP({ name: 'S2', props: { ConnectionString: 'Server=h;Pwd=pw-two' } }), SP({ name: 'S3', props: { BindingConfiguration: '<binding><security><transport clientCredentialType="Basic" password="pw-three" /></security></binding>' } }), SP({ name: 'S4', props: { Password: null, SharedAccessKeyName: 'send', UserName: 'x' } })],
    receivePorts: [RP({ name: 'L1', address: 'https://u:pw-four@h/x' })],
    extra: '  <Settings ApiKey="pw-five"><Token>pw-six</Token><Note>none</Note></Settings>'
  });
  const r = readBinding(text, 'b.xml', cfg);
  const found = r.problems.filter((p) => p.rule === 'plain-text-credential');
  assert.deepEqual(found.map((p) => [p.artifact, p.line]), [['S1', lineOf(text, '<TransportTypeData>')], ['S2', lineOf(text, '<TransportTypeData>', 2)], ['S3', lineOf(text, '<TransportTypeData>', 3)], ['L1', lineOf(text, '<Address>https')], ['', lineOf(text, '<Settings')], ['', lineOf(text, '<Token>')]]);
  assert.equal(found[0].found, `the send port "S1" holds a value for Password in plain text, in its TransportTypeData; the value is shown here as ${MASK}`);
  assert.match(found[1].found, /holds the value of Pwd in plain text, in its TransportTypeData/);
  assert.match(found[2].found, /holds a value for the attribute password in plain text, in its TransportTypeData/);
  assert.match(found[3].found, /the receive location "L1" holds the password in the user information of an address in plain text, in its Address/);
  assert.match(found[4].found, /^the binding file holds a value for the attribute ApiKey in plain text, in the element Settings/);
  assert.match(found[5].found, /^the binding file holds a value for Token in plain text, in its Token/);
  assert.ok(found.every((p) => p.artifactLine === (p.artifact === '' ? 0 : r.artifacts.find((a) => a.name === p.artifact).line)));
  for (const secret of ['pw-one', 'pw-two', 'pw-three', 'pw-four', 'pw-five', 'pw-six']) assert.ok(!JSON.stringify(r).includes(secret), secret);
  assert.ok(!found.some((p) => p.artifact === 'S4'), 'an empty password, a key name and a user name are no credentials');
});

test('bindings: an extra secret name of the configuration is found too', () => {
  const r = readBinding(bindingXml({ sendPorts: [SP({ props: { PinCode: '1234' } })] }), 'b.xml', { ...cfg, secretNames: ['pincode'] });
  assert.equal(r.problems.filter((p) => p.rule === 'plain-text-credential').length, 1);
  assert.equal(read({ sendPorts: [SP({ props: { PinCode: '1234' } })] }).problems.length, 0);
});

test('bindings: settings written as text are read a set number of levels deep', () => {
  let inner = '<Password>deep</Password>';
  for (let i = 0; i < BINDING_LIMITS.maxNestedDepth + 1; i += 1) inner = `<L>${esc(inner)}</L>`;
  const r = read({ sendPorts: [SP({ props: { Deep: inner } })] });
  assert.equal(r.problems.length, 0, 'past the limit the text is only text');
  let near = '<Password>deep</Password>';
  for (let i = 0; i < BINDING_LIMITS.maxNestedDepth - 2; i += 1) near = `<L>${esc(near)}</L>`;
  assert.equal(read({ sendPorts: [SP({ props: { Deep: near } })] }).problems.length, 1);
});

test('bindings: artifacts that cannot be read are invalid-artifact problems, and the file is still read', () => {
  const text = bindingXml({ sendPorts: [SP({ name: 'NoAdapter', adapter: '', filter: [] }), SP({ name: 'Dyn', dynamic: true }), SP({ name: '' })], receivePorts: [RP({ name: '' }), RP({ name: 'NoRlAdapter', adapter: '' }, { name: 'RP2' }), { name: '', locations: [] }], orchestrations: [{ name: '' }], parties: [{ name: '' }] }).replace('<Filter />', `<Filter>${esc('<Filter><Group>')}</Filter>`).replace('</PrimaryTransport>', `<TransportTypeData>${esc('<CustomProps><a></CustomProps>')}</TransportTypeData></PrimaryTransport>`);
  const r = readBinding(text, 'b.xml', cfg);
  assert.equal(r.read, true);
  const found = r.problems.map((p) => p.found);
  for (const f of ['a send port with no name; it is not listed or checked', 'a receive location with no name; it is not listed or checked', 'an orchestration with no name', 'a party with no name', 'the static send port "NoAdapter" names no adapter in its PrimaryTransport; its target is not known', 'the receive location "NoRlAdapter" names no adapter in ReceiveLocationTransportType; its target is not known', 'a receive port with no name; its receive locations are not listed or checked']) assert.ok(found.some((x) => x.startsWith(f) || x === f || x.includes(f.replace(/^a /, ''))), f);
  assert.ok(found.some((x) => /^the TransportTypeData of the send port "NoAdapter" is not XML the tool reads \(line 1, column 17: the end tag <\/CustomProps> where <\/a> was expected\); the settings in it are not checked$/.test(x)), found.join('\n'));
  assert.ok(found.some((x) => /^the Filter of the send port "NoAdapter" is not XML the tool reads/.test(x)));
  assert.deepEqual(r.artifacts.map((a) => a.name), ['NoAdapter', 'Dyn', 'NoRlAdapter']);
  assert.ok(r.problems.every((p) => p.rule === 'invalid-artifact'));
});

test('bindings: a file that is not XML the reader accepts, or not a binding file, is one unparsable-file problem', () => {
  const doctype = readBinding('<?xml version="1.0"?>\n<!DOCTYPE BindingInfo [<!ENTITY x SYSTEM "file:///etc/hosts">]>\n<BindingInfo>&x;</BindingInfo>', 'b.xml', cfg);
  assert.deepEqual(doctype.problems, [{ rule: 'unparsable-file', line: 2, column: 1, artifact: '', kind: '', found: 'line 2, column 1: a DOCTYPE declaration; the tool reads no document type definition, which could declare external entities (XXE) or entities that expand without bound; nothing in the file is read' }]);
  assert.equal(doctype.read, false);
  assert.deepEqual(doctype.artifacts, []);
  const other = readBinding('<Root><SendPort Name="x" /></Root>', 'b.xml', cfg);
  assert.equal(other.problems[0].found, 'the root element is <Root>, not <BindingInfo>; this is not a BizTalk binding file, and nothing in it is read');
  assert.equal(readBinding('<ns:BindingInfo xmlns:ns="urn:x" />', 'b.xml', cfg).read, true, 'a prefix on the root element is read');
  assert.deepEqual(unreadableBinding('x.xml', 'unreadable-file', 1, 1, 'why'), { file: 'x.xml', read: false, application: '', artifacts: [], groups: [], problems: [{ rule: 'unreadable-file', line: 1, column: 1, artifact: '', kind: '', found: 'why' }] });
  assert.deepEqual(readBinding('<BindingInfo />', 'b.xml', cfg).artifacts, []);
});

test('bindings: the transport and pipeline settings are read again with the limits of the run', () => {
  const r = readBinding(bindingXml({ sendPorts: [SP({ props: { A: 'x', B: 'y', C: 'z' } })] }), 'b.xml', { ...cfg, xmlLimits: { maxElements: 3 } });
  assert.equal(r.read, false, 'the file itself has more than three elements');
  const deep = readBinding(bindingXml({ sendPorts: [SP({ props: { A: 'x' } })] }).replace('<CustomProps>', '<CustomProps>'), 'b.xml', { ...cfg, xmlLimits: { maxDepth: 6 } });
  assert.equal(deep.read, true);
  assert.ok(propsXml({ A: null }).includes('vt="1"'));
});
