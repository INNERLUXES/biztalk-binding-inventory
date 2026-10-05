// The checks across the artifacts of all the binding files of a run: the suggested target of each artifact, the rules
// that look at more than one element (an orphan send port, a duplicate address), the complexity score, and the summary
// per application, per adapter and per target. The artifacts are read in src/bindings.js; docs/method.md says what
// each rule looks at.

import { KIND_LABELS } from './bindings.js';
import { listText, plural } from './size.js';
import { B2B_TARGET, CUSTOM_CODE_TARGET, DYNAMIC_TARGET, NO_TARGET, ORCHESTRATION_TARGET, PARTY_TARGET } from './targets.js';
import { adapterForm, byCode } from './words.js';

// The weight of the kind of an artifact, by its kind.
const KIND_WEIGHT = { 'receive-location': 'receiveLocation', 'send-port': 'sendPort', orchestration: 'orchestration', party: 'party' };

// The band of a complexity score: low, medium or high.
export function bandOf(score, bands) {
  if (score <= bands.low) return 'low';
  if (score <= bands.medium) return 'medium';
  return 'high';
}

// The complexity score of an artifact under the weights, with the parts it is made of, for --explain.
export function complexityOf(a, w) {
  const parts = [[KIND_WEIGHT[a.kind], w[KIND_WEIGHT[a.kind]], 1]];
  const add = (key, count) => {
    if (count > 0) parts.push([key, w[key], count]);
  };
  add('orchestrationPort', a.ports.length);
  add('unmappedAdapter', a.unmapped);
  add('customPipeline', a.pipelines.filter((p) => p.custom).length);
  add('customComponent', a.pipelines.reduce((n, p) => n + p.components.length, 0));
  add('map', a.maps.length);
  add('filterStatement', a.filterStatements);
  add('twoWay', a.twoWay ? 1 : 0);
  add('dynamicSendPort', a.dynamic ? 1 : 0);
  add('b2b', a.b2b ? 1 : 0);
  add('backupTransport', a.backupAdapter !== '' ? 1 : 0);
  return { score: parts.reduce((n, [, weight, count]) => n + weight * count, 0), parts: parts.map(([key, weight, count]) => `${key} ${weight}${count > 1 ? ` x ${count}` : ''}`) };
}

// Checks the artifacts of the files read: { artifacts, findings, summary }. Each artifact gets its targets, its
// complexity and the ids of its findings; each finding names its file, line and column, and its artifact.
export function checkInventory(files, config) {
  const artifacts = files.flatMap((f) => f.artifacts.map((a) => ({ ...a, unmapped: 0, b2b: a.kind === 'party' || a.pipelines.some((p) => p.b2b), targets: [] })));
  const findings = [];
  const add = (a, rule, found) => findings.push({ rule, file: a.file, line: a.line, column: a.column, artifact: a.name, artifactLine: a.line, kind: a.kind, found });
  const label = (a) => `the ${KIND_LABELS[a.kind]} "${a.name}"`;

  const bound = new Set();
  for (const a of artifacts) for (const p of a.ports) if (p.sendPort !== '') bound.add(p.sendPort);
  const grouped = new Set();
  for (const f of files) for (const g of f.groups) if (g.statements > 0) for (const s of g.sendPorts) grouped.add(s);
  const orchestrationsOf = new Map();
  for (const a of artifacts) if (a.kind === 'orchestration') orchestrationsOf.set(a.application, (orchestrationsOf.get(a.application) ?? 0) + 1);
  const orchestrationIndex = new Map();
  const addresses = { 'receive-location': new Map(), 'send-port': new Map() };

  for (const a of artifacts) {
    const target = (t) => {
      if (!a.targets.includes(t)) a.targets.push(t);
    };
    if (a.kind === 'orchestration') {
      target(ORCHESTRATION_TARGET);
      const n = (orchestrationIndex.get(a.application) ?? 0) + 1;
      orchestrationIndex.set(a.application, n);
      add(a, 'orchestration', `${label(a)} (${n} of ${orchestrationsOf.get(a.application)} in ${a.application || 'the binding files'}) is bound to ${plural(a.ports.length, 'port')}; its logic is in the assembly, not in the binding file`);
    } else if (a.kind === 'party') target(PARTY_TARGET);
    else {
      if (a.dynamic) {
        target(DYNAMIC_TARGET);
        add(a, 'dynamic-send-port', `${label(a)} is dynamic: its adapter and address are set at run time, and the binding file names neither`);
      } else if (a.adapter !== '') {
        const mapped = config.targets.get(adapterForm(a.adapter));
        if (mapped) target(mapped.target);
        else {
          target(NO_TARGET);
          a.unmapped += 1;
          add(a, 'unmapped-adapter', `${label(a)} uses the adapter "${a.adapter}", which has no mapped Azure target`);
        }
      } else target(NO_TARGET);
      if (a.backupAdapter !== '') {
        const mapped = config.targets.get(adapterForm(a.backupAdapter));
        if (mapped) target(mapped.target);
        else {
          a.unmapped += 1;
          add(a, 'unmapped-adapter', `${label(a)} uses the backup adapter "${a.backupAdapter}", which has no mapped Azure target`);
        }
      }
      const custom = [];
      for (const p of a.pipelines) {
        if (p.custom) custom.push(`the custom ${p.role} pipeline ${p.name}`);
        for (const c of p.components) custom.push(`the custom component ${c} in the settings of the ${p.role} pipeline`);
      }
      if (custom.length) {
        target(CUSTOM_CODE_TARGET);
        add(a, 'custom-pipeline', `${label(a)} uses ${listText(custom, 4)}, which is code to rewrite`);
      }
      if (a.b2b) target(B2B_TARGET);
      if (a.kind === 'send-port' && a.filterStatements === 0 && !bound.has(a.name) && !grouped.has(a.name)) add(a, 'orphan-send-port', `${label(a)} has no filter, no orchestration port names it and it is in no send port group with a filter, so it receives no message`);
      if (a.kind === 'receive-location' && a.enabled === false) add(a, 'disabled-receive-location', `${label(a)} is disabled`);
      if (a.addressKey !== '') {
        const key = `${adapterForm(a.adapter)}\n${a.addressKey}`;
        const first = addresses[a.kind].get(key);
        if (first) add(a, 'duplicate-address', `${label(a)} uses the same ${a.adapter || 'adapter and'} address (${a.address}) as the ${KIND_LABELS[first.kind]} "${first.name}" at ${first.file}:${first.line}`);
        else addresses[a.kind].set(key, a);
      }
    }
    const c = complexityOf(a, config.weights);
    a.complexity = c.score;
    a.complexityParts = c.parts;
    a.band = bandOf(c.score, config.bands);
  }

  // The summary per application, per adapter and per target.
  const apps = new Map();
  for (const a of artifacts) {
    if (a.application === '') continue;
    const s = apps.get(a.application) ?? { application: a.application, receiveLocations: 0, sendPorts: 0, orchestrations: 0, complexity: 0 };
    if (a.kind === 'receive-location') s.receiveLocations += 1;
    else if (a.kind === 'send-port') s.sendPorts += 1;
    else if (a.kind === 'orchestration') s.orchestrations += 1;
    s.complexity += a.complexity;
    apps.set(a.application, s);
  }
  const adapters = new Map();
  for (const a of artifacts) {
    if (a.kind !== 'receive-location' && a.kind !== 'send-port') continue;
    const name = a.dynamic ? '(dynamic)' : a.adapter === '' ? '(none)' : a.adapter;
    const form = a.dynamic ? '(dynamic)' : adapterForm(name);
    const s = adapters.get(form) ?? { adapter: name, artifacts: 0, target: a.dynamic ? DYNAMIC_TARGET : config.targets.get(form)?.target ?? null };
    s.artifacts += 1;
    adapters.set(form, s);
  }
  const targets = new Map();
  for (const a of artifacts) for (const t of a.targets) targets.set(t, (targets.get(t) ?? 0) + 1);
  const byCount = (field) => (x, y) => y.artifacts - x.artifacts || byCode(x[field], y[field]);
  const count = (kind) => artifacts.filter((a) => a.kind === kind).length;
  const summary = {
    applications: [...apps.values()],
    adapters: [...adapters.values()].sort(byCount('adapter')),
    targets: [...targets.entries()].map(([target, n]) => ({ target, artifacts: n })).sort(byCount('target')),
    totals: {
      artifacts: artifacts.length,
      applications: apps.size,
      receiveLocations: count('receive-location'),
      sendPorts: count('send-port'),
      orchestrations: count('orchestration'),
      parties: count('party'),
      complexity: artifacts.reduce((n, a) => n + a.complexity, 0),
      low: artifacts.filter((a) => a.band === 'low').length,
      medium: artifacts.filter((a) => a.band === 'medium').length,
      high: artifacts.filter((a) => a.band === 'high').length
    }
  };
  return { artifacts, findings, summary };
}
