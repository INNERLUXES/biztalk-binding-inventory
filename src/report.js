// The reports: text for a terminal, JSON for other tools, and GitHub workflow commands that turn each finding into an
// annotation on the file, line and column. The CSV inventory is in src/csv.js. Every text from the input (a file name,
// an artifact, an address or any other value) was cleaned by safeText before it reached the report object, and every
// address was masked when it was read. The GitHub commands also escape the characters a command gives a meaning to, so
// a text in the input cannot end a command early or start another one.

import { KIND_LABELS } from './bindings.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';

const clean = (t, max = 200) => safeText(t, max);

function inputLine(r) {
  const files = r.input.files;
  const read = files.filter((f) => f.read);
  const encodings = ['utf-8', 'utf-16le', 'utf-16be'].map((e) => [e, read.filter((f) => f.encoding === e).length]).filter(([, n]) => n).map(([e, n]) => `${grouped(n)} ${e === 'utf-8' ? 'UTF-8' : e === 'utf-16le' ? 'UTF-16 LE' : 'UTF-16 BE'}`);
  const folders = r.input.folders.length ? ` from ${plural(r.input.folders.length, 'folder')} (${listText(r.input.folders.map((d) => d.folder), 4)})` : '';
  return `${plural(files.length, 'binding file')}${folders}: ${grouped(read.length)} read${encodings.length ? ` (${encodings.join(', ')})` : ''}, ${grouped(files.length - read.length)} not read`;
}

function configLine(r) {
  const c = r.config;
  const where = c.file ? `${c.file}${c.name ? ` (${clean(c.name, 120)})` : ''}` : 'built-in defaults';
  const own = Object.keys(c.adapterTargets).length;
  return `${where}: ${plural(c.targetCount, 'adapter')} with a target${own ? ` (${grouped(own)} from the configuration)` : ''}; minimum severity ${c.minSeverity}; fail on ${c.failOn}`;
}

const rulesLine = (r) => r.config.rules.map((x) => `${x.id} (${x.level})`).join('; ');

function artifactsLine(r) {
  const t = r.summary.totals;
  return `${grouped(t.artifacts)} in ${plural(t.applications, 'application')}: ${plural(t.receiveLocations, 'receive location')}, ${plural(t.sendPorts, 'send port')}, ${plural(t.orchestrations, 'orchestration')}, ${plural(t.parties, 'party', 'parties')}; complexity ${grouped(t.complexity)} (${grouped(t.low)} low, ${grouped(t.medium)} medium, ${grouped(t.high)} high)`;
}

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

// A table with a header row and its columns padded to the widest cell.
function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const cell = (t, max = 60) => (t === '' || t === null || t === undefined ? '-' : clean(t, max));
const PAD = ' '.repeat(11);

function pipelineText(p) {
  const notes = [...(p.custom ? ['custom'] : []), ...(p.components.length ? [`custom ${p.components.length === 1 ? 'component' : 'components'} ${p.components.join(', ')}`] : [])];
  return `${p.role} ${p.name}${notes.length ? ` (${notes.join('; ')})` : ''}`;
}

function artifactLines(a, explain) {
  const out = [`  ${a.kind}  ${a.name}${a.application ? ` (${a.application})` : ''}  ${a.at}`];
  const field = (name, value) => {
    if (value !== '' && value !== null && value !== undefined) out.push(`${PAD}${name}: ${value}`);
  };
  if (a.kind === 'receive-location' || a.kind === 'send-port') {
    field('adapter', a.dynamic ? 'dynamic (set at run time)' : a.adapter || '(none)');
    field('backup adapter', a.backupAdapter);
    field('address', a.address);
    field('receive port', a.port);
    if (a.kind === 'receive-location') field('enabled', a.enabled ? 'yes' : 'no');
    if (a.twoWay) field('two-way', 'yes');
    field('pipelines', a.pipelines.map(pipelineText).join('; '));
    field('maps', a.maps.join(', '));
    if (a.kind === 'send-port') field('filter', a.filters.length ? a.filters.join(' OR ') : 'none');
  }
  if (a.kind === 'orchestration') {
    field('host', a.host);
    field('ports', a.ports.map((p) => `${p.name} -> ${p.sendPort ? `send port ${p.sendPort}` : p.receivePort ? `receive port ${p.receivePort}` : p.sendPortGroup ? `send port group ${p.sendPortGroup}` : 'not bound'}`).join('; '));
  }
  if (a.kind === 'party') field('send ports', a.sendPorts.join(', ') || 'none');
  field('target', a.target);
  field('complexity', `${a.complexity} (${a.band}${explain ? `: ${a.complexityParts.join(', ')}` : ''})`);
  field('findings', a.findings.join(', ') || 'none');
  out.push('');
  return out;
}

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`biztalk-binding-inventory: ${listText(r.input.paths, 6) || 'no binding file'}`);
  out.push(`input: ${inputLine(r)}`);
  out.push(`config: ${configLine(r)}`);
  out.push(`rules: ${rulesLine(r)}`);
  out.push(`artifacts: ${artifactsLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  const s = r.summary;
  out.push('', `Applications (${grouped(s.applications.length)})`, '');
  if (s.applications.length) out.push(...table(['application', 'receive locations', 'send ports', 'orchestrations', 'complexity'], s.applications.map((a) => [cell(a.application), grouped(a.receiveLocations), grouped(a.sendPorts), grouped(a.orchestrations), grouped(a.complexity)])), '');
  else out.push('  none', '');
  out.push(`Adapters (${grouped(s.adapters.length)})`, '');
  if (s.adapters.length) out.push(...table(['adapter', 'artifacts', 'suggested target'], s.adapters.map((a) => [cell(a.adapter), grouped(a.artifacts), a.target === null ? 'no mapped target' : cell(a.target, 120)])), '');
  else out.push('  none', '');
  out.push(`Targets (${grouped(s.targets.length)})`, '');
  if (s.targets.length) out.push(...table(['suggested target', 'artifacts'], s.targets.map((t) => [cell(t.target, 120), grouped(t.artifacts)])), '');
  else out.push('  none', '');
  out.push(`Artifacts (${grouped(r.artifacts.length)})`, '');
  if (!r.artifacts.length) out.push('  none', '');
  for (const a of r.artifacts) out.push(...artifactLines(a, explain));
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...r.config.rules.map((x) => x.id.length));
  for (const f of r.findings) {
    out.push(`  ${f.level.toUpperCase().padEnd(8)} ${f.rule.padEnd(width)}  ${f.at}`);
    out.push(`${PAD}${f.found}`);
    out.push(`${PAD}fix: ${f.fix}`);
    if (explain) {
      out.push(`${PAD}rule: ${r.config.rules.find((x) => x.id === f.rule).rule}`);
      for (const b of f.basis) out.push(`${PAD}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${PAD}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

export function toJson(r, { explain = false } = {}) {
  const out = {
    ...r,
    artifacts: r.artifacts.map((a) => (explain ? a : { ...a, complexityParts: undefined })),
    findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined }))
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

// The message of a workflow command: %, CR and LF escaped.
export const escapeData = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

// A property of a workflow command: also : and , escaped.
export const escapeProperty = (t) => escapeData(t).replace(/:/g, '%3A').replace(/,/g, '%2C');

const COMMANDS = { error: 'error', warning: 'warning', info: 'notice' };

export function toGithub(r) {
  const out = [];
  for (const f of r.findings) {
    const props = [`file=${escapeProperty(f.file)}`, `line=${f.line}`, ...(f.column ? [`col=${f.column}`] : []), `title=${escapeProperty(`biztalk-binding-inventory ${f.rule}`)}`];
    out.push(`::${COMMANDS[f.level]} ${props.join(',')}::${escapeData(`${f.found}; fix: ${f.fix}`)}`);
  }
  const t = r.summary.totals;
  out.push(`biztalk-binding-inventory: ${plural(t.artifacts, 'artifact')} in ${plural(t.applications, 'application')}, ${grouped(r.totals.findings)} ${r.totals.findings === 1 ? 'finding' : 'findings'}; RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

// The label of a kind of artifact, as a sentence names it.
export const kindLabel = (kind) => KIND_LABELS[kind] ?? 'file';
