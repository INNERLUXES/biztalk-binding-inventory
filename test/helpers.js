// Shared test helpers: binding files built inline, checked in memory or written into a temporary folder that is removed
// after the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and
// Windows. The line a test expects is found with lineOf(), which counts lines the way the tool does, so a test never
// holds a line number worked out by hand for one system only. No test reads the clock, the time zone or the locale.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { buildReport, defaultConfig, lineStarts, main, positionOf, readBinding, readConfig } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'biztalk-binding-inventory-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function offsetOf(text, needle, n) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return at;
}

// The line (from 1) of the n-th place where needle starts in text.
export const lineOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).line;

// The column (from 1) of the n-th place where needle starts in text.
export const columnOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).column;

// The configuration of a configuration object, through the real reader, or the defaults.
export const configOf = (object = null) => (object === null ? defaultConfig() : readConfig(JSON.stringify(object), 'config.json'));

// Text escaped for XML: a value inside an attribute or an element, or XML written as text inside another element.
export const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const XMLRECEIVE = 'Microsoft.BizTalk.DefaultPipelines.XMLReceive';
const XMLTRANSMIT = 'Microsoft.BizTalk.DefaultPipelines.XMLTransmit';

// The text of a filter of [property, operator, value] statements, as a binding file writes it: one group.
export const filterXml = (statements) => `<?xml version="1.0" encoding="utf-16"?><Filter><Group>${statements.map(([p, o, v]) => `<Statement Property="${esc(p)}" Operator="${o}"${v === undefined ? '' : ` Value="${esc(v)}"`} />`).join('')}</Group></Filter>`;

// The settings of a transport, as CustomProps.
export const propsXml = (props) => `<CustomProps>${Object.entries(props).map(([k, v]) => (v === null ? `<${k} vt="1" />` : `<${k} vt="8">${esc(v)}</${k}>`)).join('')}</CustomProps>`;

// A send port: name, adapter, address, filter (statements), and optional dynamic, twoWay, pipeline, receivePipeline,
// data (pipeline settings), props (transport settings), maps, backup ({ adapter, address }), application.
export function sendPortXml(p) {
  const lines = [`    <SendPort Name="${esc(p.name)}" IsStatic="${p.dynamic ? 'false' : 'true'}" IsTwoWay="${p.twoWay ? 'true' : 'false'}" BindingOption="0">`];
  lines.push(`      <TransmitPipeline Name="${esc(p.pipeline ?? XMLTRANSMIT)}" FullyQualifiedName="${esc(p.pipeline ?? XMLTRANSMIT)}, Pipelines, Version=1.0.0.0" Type="2" />`);
  if (p.twoWay) lines.push(`      <ReceivePipeline Name="${esc(p.receivePipeline ?? XMLRECEIVE)}" Type="1" />`);
  if (p.data) lines.push(`      <SendPipelineData>${esc(p.data)}</SendPipelineData>`);
  if (!p.dynamic) {
    lines.push('      <PrimaryTransport>', `        <Address>${esc(p.address ?? '')}</Address>`);
    if (p.adapter !== '') lines.push(`        <TransportType Name="${esc(p.adapter ?? 'FILE')}" Capabilities="11" />`);
    if (p.props) lines.push(`        <TransportTypeData>${esc(propsXml(p.props))}</TransportTypeData>`);
    lines.push('      </PrimaryTransport>');
  }
  if (p.backup) lines.push('      <SecondaryTransport>', `        <Address>${esc(p.backup.address)}</Address>`, `        <TransportType Name="${esc(p.backup.adapter)}" Capabilities="11" />`, '      </SecondaryTransport>');
  lines.push(p.filter && p.filter.length ? `      <Filter>${esc(filterXml(p.filter))}</Filter>` : '      <Filter />');
  lines.push(`      <Transforms>${(p.maps ?? []).map((m) => `<Transform FullName="${esc(m)}" />`).join('')}</Transforms>`);
  if (p.application !== '') lines.push(`      <ApplicationName>${esc(p.application ?? 'App')}</ApplicationName>`);
  lines.push('    </SendPort>');
  return lines.join('\n');
}

// A receive port with its locations: name, twoWay, maps, locations [{ name, adapter, address, enabled, pipeline, data,
// props }].
export function receivePortXml(p) {
  const lines = [`    <ReceivePort Name="${esc(p.name)}" IsTwoWay="${p.twoWay ? 'true' : 'false'}" BindingOption="0">`, '      <ReceiveLocations>'];
  for (const l of p.locations ?? []) {
    lines.push(`        <ReceiveLocation Name="${esc(l.name)}">`, `          <Address>${esc(l.address ?? '')}</Address>`);
    lines.push(`          <ReceivePipeline Name="${esc(l.pipeline ?? XMLRECEIVE)}" Type="1" />`);
    if (p.twoWay) lines.push(`          <SendPipeline Name="${esc(l.sendPipeline ?? XMLTRANSMIT)}" Type="2" />`);
    if (l.data) lines.push(`          <ReceivePipelineData>${esc(l.data)}</ReceivePipelineData>`);
    lines.push(`          <Enable>${l.enabled === false ? 'false' : 'true'}</Enable>`);
    if (l.adapter !== '') lines.push(`          <ReceiveLocationTransportType Name="${esc(l.adapter ?? 'FILE')}" Capabilities="11" />`);
    if (l.props) lines.push(`          <ReceiveLocationTransportTypeData>${esc(propsXml(l.props))}</ReceiveLocationTransportTypeData>`);
    lines.push('        </ReceiveLocation>');
  }
  lines.push('      </ReceiveLocations>', `      <Transforms>${(p.maps ?? []).map((m) => `<Transform FullName="${esc(m)}" />`).join('')}</Transforms>`, `      <ApplicationName>${esc(p.application ?? 'App')}</ApplicationName>`, '    </ReceivePort>');
  return lines.join('\n');
}

// An orchestration: name, ports [{ name, sendPort, receivePort, sendPortGroup }], host.
export function orchestrationXml(o) {
  const ports = (o.ports ?? []).map((p) => `            <Port Name="${esc(p.name)}" Modifier="2" BindingOption="1">${p.sendPort ? `<SendPortRef Name="${esc(p.sendPort)}" />` : ''}${p.receivePort ? `<ReceivePortRef Name="${esc(p.receivePort)}" />` : ''}${p.sendPortGroup ? `<DistributionListRef Name="${esc(p.sendPortGroup)}" />` : ''}</Port>`);
  return [`        <Service Name="${esc(o.name)}" State="Started">`, '          <Ports>', ...ports, '          </Ports>', `          <Host Name="${esc(o.host ?? 'Host')}" Type="1" />`, '        </Service>'].join('\n');
}

// A binding file: application, orchestrations, sendPorts, receivePorts, groups [{ name, filter, sendPorts }], parties
// [{ name, sendPorts, aliases }], and extra text inside the root element.
export function bindingXml({ application = 'App', orchestrations = [], sendPorts = [], receivePorts = [], groups = [], parties = [], extra = '' } = {}) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<BindingInfo Version="3.5.1.0">',
    '  <ModuleRefCollection>',
    `    <ModuleRef Name="[Application:${esc(application)}]"><Services /></ModuleRef>`,
    '    <ModuleRef Name="App.Processes">',
    '      <Services>',
    ...orchestrations.map(orchestrationXml),
    '      </Services>',
    '    </ModuleRef>',
    '  </ModuleRefCollection>',
    '  <SendPortCollection>',
    ...sendPorts.map(sendPortXml),
    '  </SendPortCollection>',
    '  <DistributionListCollection>',
    ...groups.map((g) => `    <DistributionList Name="${esc(g.name)}">${g.filter ? `<Filter>${esc(filterXml(g.filter))}</Filter>` : ''}<SendPorts>${g.sendPorts.map((s) => `<SendPort Name="${esc(s)}" />`).join('')}</SendPorts></DistributionList>`),
    '  </DistributionListCollection>',
    '  <ReceivePortCollection>',
    ...receivePorts.map(receivePortXml),
    '  </ReceivePortCollection>',
    '  <PartyCollection>',
    ...parties.map((p) => `    <Party Name="${esc(p.name)}"><Aliases>${(p.aliases ?? []).map((a) => `<PartyAlias Name="${esc(a)}" Qualifier="x" Value="y" />`).join('')}</Aliases><SendPorts>${(p.sendPorts ?? []).map((s) => `<SendPort Name="${esc(s)}" />`).join('')}</SendPorts></Party>`),
    '  </PartyCollection>',
    extra,
    '</BindingInfo>',
    ''
  ].join('\n');
}

// A send port with a filter, so it is no orphan: the good send port every test changes.
export const SP = (changes = {}) => ({ name: 'SP1', adapter: 'FILE', address: 'C:\\out\\%MessageID%.xml', filter: [['BTS.ReceivePortName', 0, 'RP1']], ...changes });

// A receive port with one location.
export const RP = (location = {}, port = {}) => ({ name: 'RP1', locations: [{ name: 'RL1', adapter: 'FILE', address: 'C:\\in\\*.xml', ...location }], ...port });

// The report object of binding files checked in memory: an object of path to text, with a configuration object or
// none.
export function reportOf(files, config = null, { minSeverity = 'info', failOn = 'error' } = {}) {
  const cfg = configOf(config);
  const read = Object.entries(files).map(([file, text]) => readBinding(text, file, cfg));
  return buildReport({ files: read, config: cfg, minSeverity, failOn, version: 'test' });
}

// The report object of one binding file built from these parts.
export const checkOf = (parts, config = null, options = {}) => reportOf({ 'b.xml': bindingXml(parts) }, config, options);

// The findings of a report, of one rule or of all.
export const findingsOf = (r, rule) => r.findings.filter((f) => !rule || f.rule === rule);

// The rule ids of the findings of a report, sorted.
export const sortedRules = (r) => r.findings.map((f) => f.rule).sort();

// The artifact of a report with this name.
export const artifactOf = (r, name) => r.artifacts.find((a) => a.name === name);

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err, dir };
  });
}

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, dir) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, dir);
  return { code, out, err };
}
