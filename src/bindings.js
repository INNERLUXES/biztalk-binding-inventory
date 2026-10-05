// One binding file read into artifacts: every receive location, send port, orchestration and party, with its adapter,
// masked address, pipelines, maps and filters, and the problems found inside it: a credential in plain text, an
// artifact that cannot be read, and a file that is not a binding file. The checks across artifacts are in
// src/inventory.js.
//
// The elements are read by their local names, as BizTalk Server writes a binding file (docs/inputs.md). The transport
// settings (TransportTypeData), the pipeline settings (SendPipelineData, ReceivePipelineData) and the filters (Filter)
// hold XML written as text inside the file; each is read again with the same reader and the same limits.

import { MASK, isSecretName, maskText } from './secrets.js';
import { B2B_PREFIXES } from './targets.js';
import { XmlError, attributeOf, childOf, childrenOf, localName, parseXml, textOf, xmlProblem } from './xml.js';
import { asciiLower } from './words.js';

export const BINDING_LIMITS = { maxNestedDepth: 3 };

// The kinds of artifacts, as the reports name them.
export const ARTIFACT_KINDS = ['receive-location', 'send-port', 'orchestration', 'party'];
export const KIND_LABELS = { 'receive-location': 'receive location', 'send-port': 'send port', orchestration: 'orchestration', party: 'party' };

// The operators of a filter statement, by the number a binding file writes.
export const OPERATORS = { 0: '==', 1: '<', 2: '<=', 3: '>', 4: '>=', 5: '!=', 6: 'exists' };

// The elements whose text is XML written as text, read again for their settings.
const isSettings = (local) => local.endsWith('TransportTypeData') || local.endsWith('PipelineData') || local === 'Filter';
const looksLikeXml = (t) => t.startsWith('<') && t.endsWith('>');

// True when a type name starts with one of the prefixes, compared with the letters A to Z lowered.
export const startsWithAny = (name, prefixes) => prefixes.some((p) => asciiLower(name).startsWith(asciiLower(p)));

// A file that cannot be read: its record, with one finding.
export function unreadableBinding(file, rule, line, column, found) {
  return { file, read: false, application: '', artifacts: [], groups: [], problems: [{ rule, line, column, artifact: '', kind: '', found }] };
}

// Reads the settings written as text inside an element. Returns the root element, or null and a problem.
function settingsOf(element, config) {
  const raw = element.text.trim();
  if (raw === '') return { root: null, problem: null };
  try {
    return { root: parseXml(raw, config.xmlLimits), problem: null };
  } catch (error) {
    if (error instanceof XmlError) return { root: null, problem: xmlProblem(error, raw).text };
    throw error;
  }
}

// The text of a filter: its groups, each a list of statements joined by AND, with the value of a statement whose
// property is the name of a secret masked. Returns { groups, statements, problem }.
export function filterOf(element, config) {
  if (!element) return { groups: [], statements: 0, problem: null };
  const { root, problem } = settingsOf(element, config);
  if (!root) return { groups: [], statements: 0, problem };
  const groups = [];
  let statements = 0;
  for (const g of childrenOf(root, 'Group')) {
    const parts = [];
    for (const s of childrenOf(g, 'Statement')) {
      const property = attributeOf(s, 'Property');
      const operator = OPERATORS[attributeOf(s, 'Operator')] ?? `operator ${attributeOf(s, 'Operator').slice(0, 12)}`;
      let value = attributeOf(s, 'Value');
      if (isSecretName(property.slice(property.lastIndexOf('.') + 1), config.secretNames) && value !== '') value = MASK;
      else value = maskText(value, config.secretNames).text;
      parts.push(operator === 'exists' ? `${property} exists` : `${property} ${operator} ${value}`);
      statements += 1;
    }
    if (parts.length) groups.push(parts.join(' AND '));
  }
  return { groups, statements, problem: null };
}

// A pipeline of a port: { role, name, custom, b2b, components }, where components are the custom components named in
// its settings. Returns null when the port names no pipeline there.
function pipelineOf(port, role, local, dataLocal, config) {
  const element = childOf(port, local);
  const name = attributeOf(element, 'Name');
  if (!element || name === '') return null;
  const components = [];
  const data = childOf(port, dataLocal);
  if (data && data.text.trim() !== '') {
    const { root } = settingsOf(data, config);
    if (root) {
      const todo = [root];
      while (todo.length) {
        const e = todo.pop();
        if (e.local === 'Component') {
          const c = attributeOf(e, 'Name');
          if (c !== '' && !startsWithAny(c, config.builtInPrefixes) && !components.includes(c)) components.push(c);
        }
        for (let k = e.children.length - 1; k >= 0; k -= 1) todo.push(e.children[k]);
      }
    }
  }
  return { role, name, custom: !startsWithAny(name, config.builtInPrefixes), b2b: startsWithAny(name, B2B_PREFIXES), components };
}

// The full names of the maps under an element of a port.
const mapsOf = (port, local) => childrenOf(childOf(port, local), 'Transform').map((t) => attributeOf(t, 'FullName') || attributeOf(t, 'AssemblyQualifiedName')).filter((m) => m !== '');

// Looks through an element and everything inside it for credentials in plain text, including the settings written as
// text inside it, and adds a problem for each. covered collects the elements looked at, so the rest of the file can be
// looked through once afterwards.
function scanCredentials(element, owner, config, problems, covered) {
  const where = owner.name === '' ? 'the binding file' : `the ${KIND_LABELS[owner.kind]} "${owner.name}"`;
  const seen = new Set();
  const hit = (what, place, at) => {
    const key = `${what}\n${place}\n${at.line}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push({ rule: 'plain-text-credential', line: at.line, column: at.column, artifact: owner.name, artifactLine: owner.line ?? 0, kind: owner.kind, found: `${where} holds ${what} in plain text, in ${place}; the value is shown here as ${MASK}` });
  };
  const walk = (root, place, at, depth, track) => {
    const todo = [root];
    while (todo.length) {
      const e = todo.pop();
      if (track) {
        if (covered.has(e)) continue;
        covered.add(e);
      }
      const here = track ? e : at;
      const inPlace = place === null ? `the element ${e.local}` : place;
      for (const [name, value] of e.attributes) {
        if (value.trim() === '') continue;
        if (isSecretName(localName(name), config.secretNames)) hit(`a value for the attribute ${localName(name)}`, inPlace, here);
        else for (const f of maskText(value, config.secretNames).found) hit(f, inPlace, here);
      }
      const text = e.text.trim();
      if (e.children.length === 0 && text !== '') {
        const inner = track ? isSettings(e.local) : depth < BINDING_LIMITS.maxNestedDepth && looksLikeXml(text);
        let root = null;
        if (inner && looksLikeXml(text)) {
          try {
            root = parseXml(text, config.xmlLimits);
          } catch (error) {
            if (!(error instanceof XmlError)) throw error;
          }
        }
        if (root) walk(root, place === null ? `its ${e.local}` : place, here, depth + 1, false);
        else if (isSecretName(e.local, config.secretNames)) hit(`a value for ${e.local}`, place === null ? `its ${e.local}` : place, here);
        else for (const f of maskText(text, config.secretNames).found) hit(f, place === null ? `its ${e.local}` : place, here);
      }
      for (let k = e.children.length - 1; k >= 0; k -= 1) todo.push(e.children[k]);
    }
  };
  walk(element, null, element, 0, true);
}

// The address of a transport, masked: { address, key }, where key is the form addresses are compared in.
export function addressOf(raw, config) {
  const address = maskText(raw, config.secretNames).text;
  let key = asciiLower(address.trim()).split('\\').join('/');
  while (key.endsWith('/')) key = key.slice(0, -1);
  return { address, key };
}

// Adds a problem for settings inside an element that the reader refuses.
function checkSettings(element, owner, config, problems) {
  if (!element || element.text.trim() === '') return;
  const { problem } = settingsOf(element, config);
  if (problem) problems.push({ rule: 'invalid-artifact', line: element.line, column: element.column, artifact: owner.name, artifactLine: owner.line, kind: owner.kind, found: `the ${element.local} of the ${KIND_LABELS[owner.kind]} "${owner.name}" is not XML the tool reads (${problem}); the settings in it are not checked` });
}

// Reads the text of one binding file: { file, read, application, artifacts, groups, problems }. A text that the reader
// refuses, or whose root element is not BindingInfo, is one unparsable-file problem and nothing else.
export function readBinding(text, file, config) {
  let root;
  try {
    root = parseXml(text, config.xmlLimits);
  } catch (error) {
    if (!(error instanceof XmlError)) throw error;
    const p = xmlProblem(error, text);
    return unreadableBinding(file, 'unparsable-file', p.line, p.column, `${p.text}; nothing in the file is read`);
  }
  if (root.local !== 'BindingInfo') return unreadableBinding(file, 'unparsable-file', root.line, root.column, `the root element is <${root.name.slice(0, 60)}>, not <BindingInfo>; this is not a BizTalk binding file, and nothing in it is read`);

  const problems = [];
  const artifacts = [];
  const covered = new Set();
  const modules = childrenOf(childOf(root, 'ModuleRefCollection'), 'ModuleRef');
  const named = modules.map((m) => /^\[Application:(.*)\]$/.exec(attributeOf(m, 'Name'))).filter(Boolean).map((m) => m[1].trim());
  const application = named.length ? named[0] : '';
  const missing = (element, kind) => problems.push({ rule: 'invalid-artifact', line: element.line, column: element.column, artifact: '', kind, found: `${/^[aeiou]/.test(KIND_LABELS[kind]) ? 'an' : 'a'} ${KIND_LABELS[kind]} with no name; it is not listed or checked` });
  const base = (element, kind, name, app) => ({ kind, name, application: app, file, line: element.line, column: element.column, adapter: '', backupAdapter: '', address: '', addressKey: '', port: '', enabled: null, dynamic: false, twoWay: false, pipelines: [], maps: [], filters: [], filterStatements: 0, ports: [], host: '', sendPorts: [], aliases: 0 });

  for (const m of modules) {
    for (const s of childrenOf(childOf(m, 'Services'), 'Service')) {
      const name = attributeOf(s, 'Name');
      if (name === '') {
        missing(s, 'orchestration');
        continue;
      }
      const a = base(s, 'orchestration', name, application);
      a.host = attributeOf(childOf(s, 'Host'), 'Name');
      for (const p of childrenOf(childOf(s, 'Ports'), 'Port')) {
        a.ports.push({ name: attributeOf(p, 'Name'), sendPort: attributeOf(childOf(p, 'SendPortRef'), 'Name'), receivePort: attributeOf(childOf(p, 'ReceivePortRef'), 'Name'), sendPortGroup: attributeOf(childOf(p, 'DistributionListRef'), 'Name') });
      }
      artifacts.push(a);
      scanCredentials(s, a, config, problems, covered);
    }
  }

  for (const sp of childrenOf(childOf(root, 'SendPortCollection'), 'SendPort')) {
    const name = attributeOf(sp, 'Name');
    if (name === '') {
      missing(sp, 'send-port');
      continue;
    }
    const a = base(sp, 'send-port', name, textOf(sp, 'ApplicationName') || application);
    a.dynamic = attributeOf(sp, 'IsStatic') === 'false';
    a.twoWay = attributeOf(sp, 'IsTwoWay') === 'true';
    const primary = childOf(sp, 'PrimaryTransport');
    a.adapter = attributeOf(childOf(primary, 'TransportType'), 'Name');
    Object.assign(a, (({ address, key }) => ({ address, addressKey: key }))(addressOf(textOf(primary, 'Address'), config)));
    const secondary = childOf(sp, 'SecondaryTransport');
    a.backupAdapter = attributeOf(childOf(secondary, 'TransportType'), 'Name');
    for (const p of [pipelineOf(sp, 'send', 'TransmitPipeline', 'SendPipelineData', config), a.twoWay ? pipelineOf(sp, 'receive', 'ReceivePipeline', 'ReceivePipelineData', config) : null]) if (p) a.pipelines.push(p);
    a.maps = [...mapsOf(sp, 'Transforms'), ...mapsOf(sp, 'InboundTransforms')];
    const filter = filterOf(childOf(sp, 'Filter'), config);
    a.filters = filter.groups;
    a.filterStatements = filter.statements;
    if (!a.dynamic && a.adapter === '') problems.push({ rule: 'invalid-artifact', line: sp.line, column: sp.column, artifact: name, artifactLine: sp.line, kind: 'send-port', found: `the static send port "${name}" names no adapter in its PrimaryTransport; its target is not known` });
    for (const e of [childOf(primary, 'TransportTypeData'), childOf(secondary, 'TransportTypeData'), childOf(sp, 'SendPipelineData'), childOf(sp, 'ReceivePipelineData'), childOf(sp, 'Filter')]) checkSettings(e, a, config, problems);
    artifacts.push(a);
    scanCredentials(sp, a, config, problems, covered);
  }

  const groups = [];
  for (const g of childrenOf(childOf(root, 'DistributionListCollection'), 'DistributionList')) {
    const members = [...childrenOf(childOf(g, 'SendPorts'), 'SendPort'), ...childrenOf(childOf(g, 'SendPorts'), 'SendPortRef')].map((x) => attributeOf(x, 'Name')).filter((x) => x !== '');
    groups.push({ name: attributeOf(g, 'Name'), statements: filterOf(childOf(g, 'Filter'), config).statements, sendPorts: members });
  }

  for (const rp of childrenOf(childOf(root, 'ReceivePortCollection'), 'ReceivePort')) {
    const portName = attributeOf(rp, 'Name');
    if (portName === '') {
      problems.push({ rule: 'invalid-artifact', line: rp.line, column: rp.column, artifact: '', kind: 'receive-location', found: 'a receive port with no name; its receive locations are not listed or checked' });
      continue;
    }
    const twoWay = attributeOf(rp, 'IsTwoWay') === 'true';
    const maps = [...mapsOf(rp, 'Transforms'), ...mapsOf(rp, 'OutboundTransforms')];
    const app = textOf(rp, 'ApplicationName') || application;
    for (const rl of childrenOf(childOf(rp, 'ReceiveLocations'), 'ReceiveLocation')) {
      const name = attributeOf(rl, 'Name');
      if (name === '') {
        missing(rl, 'receive-location');
        continue;
      }
      const a = base(rl, 'receive-location', name, app);
      a.port = portName;
      a.twoWay = twoWay;
      a.enabled = textOf(rl, 'Enable') !== 'false';
      a.adapter = attributeOf(childOf(rl, 'ReceiveLocationTransportType'), 'Name');
      Object.assign(a, (({ address, key }) => ({ address, addressKey: key }))(addressOf(textOf(rl, 'Address'), config)));
      for (const p of [pipelineOf(rl, 'receive', 'ReceivePipeline', 'ReceivePipelineData', config), twoWay ? pipelineOf(rl, 'send', 'SendPipeline', 'SendPipelineData', config) : null]) if (p) a.pipelines.push(p);
      a.maps = maps;
      if (a.adapter === '') problems.push({ rule: 'invalid-artifact', line: rl.line, column: rl.column, artifact: name, artifactLine: rl.line, kind: 'receive-location', found: `the receive location "${name}" names no adapter in ReceiveLocationTransportType; its target is not known` });
      for (const e of [childOf(rl, 'ReceiveLocationTransportTypeData'), childOf(rl, 'ReceivePipelineData'), childOf(rl, 'SendPipelineData')]) checkSettings(e, a, config, problems);
      artifacts.push(a);
      scanCredentials(rl, a, config, problems, covered);
    }
  }

  for (const party of childrenOf(childOf(root, 'PartyCollection'), 'Party')) {
    const name = attributeOf(party, 'Name');
    if (name === '') {
      missing(party, 'party');
      continue;
    }
    const a = base(party, 'party', name, '');
    a.sendPorts = [...childrenOf(childOf(party, 'SendPorts'), 'SendPort'), ...childrenOf(childOf(party, 'SendPorts'), 'SendPortRef')].map((x) => attributeOf(x, 'Name')).filter((x) => x !== '');
    a.aliases = childrenOf(childOf(party, 'Aliases'), 'PartyAlias').length;
    artifacts.push(a);
    scanCredentials(party, a, config, problems, covered);
  }

  // The rest of the file, outside the artifacts, is looked through once for credentials too.
  scanCredentials(root, { kind: '', name: '' }, config, problems, covered);
  return { file, read: true, application, artifacts, groups, problems };
}
