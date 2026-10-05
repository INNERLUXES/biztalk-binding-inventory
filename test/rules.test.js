import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B2B_TARGET, COMPLEXITY_BANDS, CUSTOM_CODE_TARGET, DEFAULT_WEIGHTS, DYNAMIC_TARGET, NO_TARGET, ORCHESTRATION_TARGET, PARTY_TARGET, atOrAbove, bandOf, checkInventory, complexityOf, decide, defaultConfig, readBinding, ruleById } from '../src/index.js';
import { RP, SP, artifactOf, bindingXml, checkOf, findingsOf, reportOf, sortedRules } from './helpers.js';

// Every rule, each with a near miss on each side: the form that is reported and the form next to it that is not.

test('unmapped-adapter: an adapter in no entry of the table or the configuration, primary or backup', () => {
  const r = checkOf({ sendPorts: [SP({ name: 'A', adapter: 'Contoso.Telex' }), SP({ name: 'B', adapter: ' wcf-sql ' }), SP({ name: 'C', backup: { adapter: 'Contoso.Fax', address: 'x' } }), SP({ name: 'D', backup: { adapter: 'FTP', address: 'ftp://h/' } })], receivePorts: [RP({ adapter: 'WCF-Custom' })] });
  assert.deepEqual(findingsOf(r, 'unmapped-adapter').map((f) => f.found), ['the send port "A" uses the adapter "Contoso.Telex", which has no mapped Azure target', 'the send port "C" uses the backup adapter "Contoso.Fax", which has no mapped Azure target', 'the receive location "RL1" uses the adapter "WCF-Custom", which has no mapped Azure target']);
  assert.deepEqual(artifactOf(r, 'A').targets, [NO_TARGET]);
  assert.deepEqual(artifactOf(r, 'B').targets, ['Logic Apps SQL Server connector'], 'an adapter is compared trimmed, in any case');
  assert.deepEqual(artifactOf(r, 'D').targets, ['Logic Apps File System connector or Azure Blob Storage', 'Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP)']);
  const mapped = checkOf({ sendPorts: [SP({ adapter: 'Contoso.Telex' })] }, { adapterTargets: { 'contoso.telex': 'Azure Functions (telex gateway)' } });
  assert.deepEqual(findingsOf(mapped, 'unmapped-adapter'), []);
  assert.deepEqual(artifactOf(mapped, 'SP1').targets, ['Azure Functions (telex gateway)']);
  assert.equal(findingsOf(r, 'unmapped-adapter')[0].level, 'warning');
});

test('unmapped-adapter: every adapter of the table has its target', () => {
  const adapters = ['FILE', 'FTP', 'SFTP', 'HTTP', 'SOAP', 'WCF-BasicHttp', 'WCF-WSHttp', 'WCF-WebHttp', 'WCF-SQL', 'SQL', 'MQSeries', 'MQSC', 'SB-Messaging', 'SAP', 'WCF-SAP', 'MSMQ', 'WCF-NetMsmq', 'SMTP', 'POP3', 'Windows SharePoint Services', 'LogicApp'];
  const r = checkOf({ sendPorts: adapters.map((adapter, i) => SP({ name: `S${i}`, adapter, address: `x${i}` })) });
  assert.deepEqual(findingsOf(r, 'unmapped-adapter'), []);
  const target = (i) => artifactOf(r, `S${i}`).targets[0];
  assert.equal(target(adapters.indexOf('MQSeries')), 'Logic Apps IBM MQ connector');
  assert.equal(target(adapters.indexOf('SB-Messaging')), 'Azure Service Bus');
  assert.equal(target(adapters.indexOf('MSMQ')), 'Azure Service Bus queues');
  assert.equal(target(adapters.indexOf('WCF-SAP')), 'Logic Apps SAP connector');
  assert.equal(target(adapters.indexOf('POP3')), 'Logic Apps Office 365 Outlook connector');
  assert.equal(target(adapters.indexOf('SMTP')), 'Logic Apps SMTP or Office 365 Outlook connector');
  assert.equal(target(adapters.indexOf('SOAP')), 'API Management + Logic Apps or Azure Functions');
});

test('custom-pipeline: a custom pipeline or a custom component in the settings, and not a built-in one', () => {
  const data = '<Root><Stages><Stage><Components><Component Name="Contoso.Strip" /><Component Name="Microsoft.BizTalk.Component.FFDasmComp" /></Components></Stage></Stages></Root>';
  const r = checkOf({ sendPorts: [SP({ name: 'A', pipeline: 'Contoso.Zip' }), SP({ name: 'B' }), SP({ name: 'C', data: data.replace('Contoso.Strip', 'Microsoft.BizTalk.Component.XmlAsmComp') })], receivePorts: [RP({ pipeline: 'Contoso.FlatIn', data })] });
  assert.deepEqual(findingsOf(r, 'custom-pipeline').map((f) => f.found), ['the send port "A" uses the custom send pipeline Contoso.Zip, which is code to rewrite', 'the receive location "RL1" uses the custom receive pipeline Contoso.FlatIn and the custom component Contoso.Strip in the settings of the receive pipeline, which is code to rewrite']);
  assert.ok(artifactOf(r, 'A').targets.includes(CUSTOM_CODE_TARGET));
  assert.ok(!artifactOf(r, 'B').targets.includes(CUSTOM_CODE_TARGET));
  const prefixed = checkOf({ sendPorts: [SP({ pipeline: 'Contoso.Zip' })] }, { builtInPrefixes: ['Contoso.'] });
  assert.deepEqual(findingsOf(prefixed, 'custom-pipeline'), []);
});

test('orchestration: every orchestration, with the count of its application, as info', () => {
  const r = checkOf({ orchestrations: [{ name: 'O1', ports: [{ name: 'p', sendPort: 'SP1' }] }, { name: 'O2' }], sendPorts: [SP()] });
  assert.deepEqual(findingsOf(r, 'orchestration').map((f) => [f.level, f.found]), [['info', 'the orchestration "O1" (1 of 2 in App) is bound to 1 port; its logic is in the assembly, not in the binding file'], ['info', 'the orchestration "O2" (2 of 2 in App) is bound to 0 ports; its logic is in the assembly, not in the binding file']]);
  assert.deepEqual(artifactOf(r, 'O1').targets, [ORCHESTRATION_TARGET]);
  assert.deepEqual(findingsOf(checkOf({ sendPorts: [SP()] }), 'orchestration'), []);
  const none = reportOf({ 'b.xml': bindingXml({ orchestrations: [{ name: 'O' }] }).replace('[Application:App]', 'Lib') });
  assert.match(findingsOf(none, 'orchestration')[0].found, /\(1 of 1 in the binding files\)/);
});

test('orphan-send-port: no filter, no orchestration port, no send port group with a filter', () => {
  const r = checkOf({
    orchestrations: [{ name: 'O', ports: [{ name: 'p', sendPort: 'Bound' }] }],
    sendPorts: [SP({ name: 'Orphan', filter: [] }), SP({ name: 'Bound', filter: [] }), SP({ name: 'Filtered' }), SP({ name: 'Grouped', filter: [] }), SP({ name: 'InEmptyGroup', filter: [] }), SP({ name: 'DynOrphan', dynamic: true, filter: [] })],
    groups: [{ name: 'G1', filter: [['BTS.MessageType', 0, 'x']], sendPorts: ['Grouped'] }, { name: 'G2', sendPorts: ['InEmptyGroup'] }]
  });
  assert.deepEqual(findingsOf(r, 'orphan-send-port').map((f) => f.artifact), ['Orphan', 'InEmptyGroup', 'DynOrphan']);
  assert.equal(findingsOf(r, 'orphan-send-port')[0].found, 'the send port "Orphan" has no filter, no orchestration port names it and it is in no send port group with a filter, so it receives no message');
  // An orchestration in another file of the run binds a send port too.
  const two = reportOf({ 'a.xml': bindingXml({ sendPorts: [SP({ name: 'X', filter: [] })] }), 'b.xml': bindingXml({ orchestrations: [{ name: 'O', ports: [{ name: 'p', sendPort: 'X' }] }] }) });
  assert.deepEqual(findingsOf(two, 'orphan-send-port'), []);
});

test('disabled-receive-location: Enable false, and not true or missing', () => {
  const r = checkOf({ receivePorts: [{ name: 'RP1', locations: [{ name: 'Off', address: 'a', enabled: false }, { name: 'On', address: 'b' }] }] });
  assert.deepEqual(findingsOf(r, 'disabled-receive-location').map((f) => [f.level, f.found]), [['info', 'the receive location "Off" is disabled']]);
  const missing = reportOf({ 'b.xml': bindingXml({ receivePorts: [RP()] }).replace('<Enable>true</Enable>', '') });
  assert.equal(artifactOf(missing, 'RL1').enabled, true);
});

test('duplicate-address: the same adapter and address in another receive location or send port of the same kind', () => {
  const r = checkOf({
    receivePorts: [{ name: 'RP1', locations: [{ name: 'L1', address: 'C:\\In\\*.xml' }, { name: 'L2', address: 'c:/in/*.XML' }, { name: 'L3', address: 'C:\\In\\*.xml', adapter: 'FTP' }, { name: 'L4', address: '' }, { name: 'L5', address: '' }] }],
    sendPorts: [SP({ name: 'S1', address: 'C:\\In\\*.xml' }), SP({ name: 'S2', address: 'ftp://h/out/' }), SP({ name: 'S3', address: 'FTP://H/out', adapter: 'file' }), SP({ name: 'S4', address: 'ftp://h/out' , adapter: 'FTP' })]
  });
  assert.deepEqual(findingsOf(r, 'duplicate-address').map((f) => f.artifact), ['S3', 'L2']);
  assert.match(findingsOf(r, 'duplicate-address')[1].found, /^the receive location "L2" uses the same FILE address \(c:\/in\/\*\.XML\) as the receive location "L1" at b\.xml:\d+$/);
  assert.equal(findingsOf(r, 'duplicate-address')[0].level, 'error');
  const across = reportOf({ 'a.xml': bindingXml({ receivePorts: [RP()] }), 'b.xml': bindingXml({ receivePorts: [RP({ name: 'Other' })] }) });
  assert.match(findingsOf(across, 'duplicate-address')[0].found, /as the receive location "RL1" at a\.xml:/);
});

test('plain-text-credential: an error, with the value never in the report', () => {
  const r = checkOf({ sendPorts: [SP({ props: { Password: 'hunter-two' } })] });
  assert.deepEqual(findingsOf(r, 'plain-text-credential').map((f) => f.level), ['error']);
  assert.ok(!JSON.stringify(r).includes('hunter-two'));
  assert.equal(r.result.pass, false);
  assert.deepEqual(artifactOf(r, 'SP1').findings, ['error plain-text-credential']);
  assert.deepEqual(findingsOf(checkOf({ sendPorts: [SP({ props: { Password: null } })] }), 'plain-text-credential'), []);
});

test('dynamic-send-port: IsStatic false, and not true', () => {
  const r = checkOf({ orchestrations: [{ name: 'O', ports: [{ name: 'p', sendPort: 'D' }] }], sendPorts: [SP({ name: 'D', dynamic: true, filter: [] }), SP({ name: 'S' })] });
  assert.deepEqual(findingsOf(r, 'dynamic-send-port').map((f) => [f.level, f.found]), [['warning', 'the send port "D" is dynamic: its adapter and address are set at run time, and the binding file names neither']]);
  assert.deepEqual(artifactOf(r, 'D').targets, [DYNAMIC_TARGET]);
  assert.deepEqual(findingsOf(r, 'invalid-artifact'), [], 'a dynamic port needs no adapter');
});

test('parties and EDI: a party and an EDI or AS2 pipeline get the B2B targets', () => {
  const r = checkOf({ sendPorts: [SP({ name: 'As2', pipeline: 'Microsoft.BizTalk.Edi.DefaultPipelines.AS2EdiSend', adapter: 'HTTP' })], parties: [{ name: 'P1', sendPorts: ['As2'] }] });
  assert.deepEqual(artifactOf(r, 'As2').targets, ['API Management + Logic Apps or Azure Functions', B2B_TARGET]);
  assert.deepEqual(artifactOf(r, 'P1').targets, [PARTY_TARGET]);
  assert.deepEqual(r.findings, []);
});

test('complexity: the weights add up, the bands split them, and the configuration changes them', () => {
  const r = checkOf({ orchestrations: [{ name: 'O', ports: [{ name: 'a', sendPort: 'SP1' }, { name: 'b', receivePort: 'RP1' }] }], sendPorts: [SP({ pipeline: 'Contoso.Zip', data: '<Root><Component Name="Contoso.A" /><Component Name="Contoso.B" /></Root>', maps: ['M1', 'M2'], twoWay: true, adapter: 'Contoso.Telex', backup: { adapter: 'FILE', address: 'x' } })], receivePorts: [RP()] });
  const w = DEFAULT_WEIGHTS;
  assert.equal(artifactOf(r, 'O').complexity, w.orchestration + 2 * w.orchestrationPort);
  assert.equal(artifactOf(r, 'SP1').complexity, w.sendPort + w.unmappedAdapter + w.customPipeline + 2 * w.customComponent + 2 * w.map + w.filterStatement + w.twoWay + w.backupTransport);
  assert.deepEqual(artifactOf(r, 'SP1').complexityParts, ['sendPort 1', 'unmappedAdapter 3', 'customPipeline 3', 'customComponent 2 x 2', 'map 1 x 2', 'filterStatement 1', 'twoWay 1', 'backupTransport 1']);
  assert.equal(artifactOf(r, 'SP1').band, 'high');
  assert.equal(artifactOf(r, 'RL1').complexity, w.receiveLocation);
  assert.equal(artifactOf(r, 'RL1').band, 'low');
  assert.equal(r.summary.totals.complexity, r.artifacts.reduce((n, a) => n + a.complexity, 0));
  const c = checkOf({ orchestrations: [{ name: 'O' }] }, { weights: { orchestration: 0 } });
  assert.equal(artifactOf(c, 'O').complexity, 0);
  assert.deepEqual([bandOf(COMPLEXITY_BANDS.low, COMPLEXITY_BANDS), bandOf(COMPLEXITY_BANDS.low + 1, COMPLEXITY_BANDS), bandOf(COMPLEXITY_BANDS.medium, COMPLEXITY_BANDS), bandOf(COMPLEXITY_BANDS.medium + 1, COMPLEXITY_BANDS)], ['low', 'medium', 'medium', 'high']);
  const party = { kind: 'party', ports: [], unmapped: 0, pipelines: [], maps: [], filterStatements: 0, twoWay: false, dynamic: true, b2b: true, backupAdapter: '' };
  assert.deepEqual(complexityOf(party, w), { score: w.party + w.dynamicSendPort + w.b2b, parts: ['party 2', 'dynamicSendPort 2', 'b2b 3'] });
});

test('summary: per application, per adapter and per target, in a fixed order', () => {
  const r = checkOf({ orchestrations: [{ name: 'O' }], sendPorts: [SP({ name: 'A', adapter: 'FTP', address: 'a' }), SP({ name: 'B', adapter: 'ftp', address: 'b' }), SP({ name: 'C', adapter: 'FILE', address: 'c' }), SP({ name: 'D', dynamic: true }), SP({ name: 'E', adapter: 'Zeta', address: 'e' })], receivePorts: [RP()], parties: [{ name: 'P' }] });
  assert.deepEqual(r.summary.applications, [{ application: 'App', receiveLocations: 1, sendPorts: 5, orchestrations: 1, complexity: r.artifacts.filter((a) => a.application === 'App').reduce((n, a) => n + a.complexity, 0) }]);
  assert.deepEqual(r.summary.adapters.map((a) => [a.adapter, a.artifacts, a.target === null]), [['FILE', 2, false], ['FTP', 2, false], ['(dynamic)', 1, false], ['Zeta', 1, true]]);
  assert.deepEqual(r.summary.targets.map((t) => t.artifacts), [2, 2, 1, 1, 1, 1]);
  assert.deepEqual(r.summary.totals, { artifacts: 8, applications: 1, receiveLocations: 1, sendPorts: 5, orchestrations: 1, parties: 1, complexity: r.summary.totals.complexity, low: r.summary.totals.low, medium: r.summary.totals.medium, high: r.summary.totals.high });
  assert.equal(r.summary.totals.low + r.summary.totals.medium + r.summary.totals.high, 8);
  const none = checkInventory([readBinding(bindingXml({ sendPorts: [SP({ adapter: '' })] }), 'b.xml', defaultConfig())], defaultConfig());
  assert.deepEqual(none.summary.adapters.map((a) => a.adapter), ['(none)']);
  assert.deepEqual(none.artifacts[0].targets, [NO_TARGET]);
});

test('levels: a rule set lower, higher or off, and the input rules that cannot be set', () => {
  const parts = { sendPorts: [SP({ name: 'D', dynamic: true, filter: [] })] };
  assert.deepEqual(sortedRules(checkOf(parts)), ['dynamic-send-port', 'orphan-send-port']);
  const r = checkOf(parts, { rules: { dynamicSendPort: 'error', orphanSendPort: 'off' } });
  assert.deepEqual(r.findings.map((f) => [f.rule, f.level]), [['dynamic-send-port', 'error']]);
  assert.match(r.notes.join('\n'), /1 rule is off: orphan-send-port/);
  assert.equal(r.result.pass, false);
  assert.equal(ruleById('invalid-artifact').key, null);
  assert.equal(ruleById('nope'), undefined);
});

test('result: pass and fail at each level', () => {
  const f = (level) => ({ level });
  assert.deepEqual(decide([f('warning'), f('info')], 'error'), { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 1, info: 1 }, text: 'PASS - no finding at or above error (1 warning, 1 info)' });
  assert.equal(decide([f('warning')], 'warning').text, 'FAIL - 1 finding at or above warning (1 warning)');
  assert.equal(decide([], 'info').text, 'PASS - no finding at or above info');
  assert.equal(atOrAbove('error', 'info'), true);
  assert.equal(atOrAbove('info', 'warning'), false);
});
