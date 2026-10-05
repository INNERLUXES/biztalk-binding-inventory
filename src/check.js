// A run: read the configuration and the binding files, check them, and build the report of the run. A path on the
// command line that cannot be used (missing, a link, a file of no kind the tool reads), a configuration with a
// problem, or input past the limit of a run stops the run with an InputError and no result. A binding file that cannot
// be read, or that the reader refuses, is an error finding of its own, so the run fails at the default level and never
// passes because a part of the input was passed over.

import { readBinding, unreadableBinding } from './bindings.js';
import { ConfigError, defaultConfig, readConfig } from './config.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, inspectPath, listFolder, readText, readTextFile } from './files.js';
import { checkInventory } from './inventory.js';
import { fileKind } from './kinds.js';
import { RULES, atOrAbove, decide } from './rules.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';
import { XML_LIMITS } from './xml.js';

export const LIMITS = { ...FILE_LIMITS, ...XML_LIMITS, maxFindingsPerRule: 500 };
export const MAX_PROBLEMS = 20;

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

// A copy of a value with every text in it cleaned by safeText, for the parts of the report that come from the input.
export function cleanTexts(value) {
  if (typeof value === 'string') return safeText(value, 300);
  if (Array.isArray(value)) return value.map(cleanTexts);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanTexts(v)]));
  return value;
}

// A list of problems for an error message: the first twenty, then a count.
export function capped(problems) {
  return problems.length > MAX_PROBLEMS ? [...problems.slice(0, MAX_PROBLEMS), `and ${grouped(problems.length - MAX_PROBLEMS)} more`] : problems;
}

// The level of a rule under a configuration: the rules of input problems are always errors.
export function levelOf(rule, config) {
  return rule.key === null ? 'error' : config.rules[rule.key];
}

// The limits of the XML reader, from the limits of a run.
const xmlLimitsOf = (limits) => Object.fromEntries(Object.keys(XML_LIMITS).map((k) => [k, limits[k] ?? XML_LIMITS[k]]));

// An artifact as the report shows it: the fields a reader needs, every text cleaned.
function shownArtifact(a, findings) {
  return cleanTexts({
    kind: a.kind,
    name: a.name,
    application: a.application,
    file: a.file,
    line: a.line,
    column: a.column,
    at: `${a.file}:${a.line}`,
    adapter: a.adapter,
    backupAdapter: a.backupAdapter,
    address: a.address,
    port: a.port,
    enabled: a.enabled,
    dynamic: a.dynamic,
    twoWay: a.twoWay,
    pipelines: a.pipelines.map((p) => ({ role: p.role, name: p.name, custom: p.custom, components: p.components })),
    maps: a.maps,
    filters: a.filters,
    ports: a.ports,
    host: a.host,
    sendPorts: a.sendPorts,
    targets: a.targets,
    target: a.targets.join(' + '),
    complexity: a.complexity,
    band: a.band,
    complexityParts: a.complexityParts,
    findings
  });
}

// The run as a report object, from the files that were read and the configuration.
export function buildReport({ files, folders = [], config, minSeverity, failOn, version, limits = LIMITS }) {
  const { artifacts, findings: checked, summary } = checkInventory(files.filter((f) => f.read), config);
  const raw = [...files.flatMap((f) => f.problems.map((p) => ({ file: f.file, ...p }))), ...checked];
  const ruleOrder = new Map(RULES.map((r, i) => [r.id, i]));
  const fileOrder = new Map(files.map((f, i) => [f.file, i]));
  const level = (id) => levelOf(RULES.find((r) => r.id === id), config);
  const order = (a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || fileOrder.get(a.file) - fileOrder.get(b.file) || a.line - b.line || a.column - b.column || ruleOrder.get(a.rule) - ruleOrder.get(b.rule);
  const all = raw.filter((f) => level(f.rule) !== 'off').map((f) => ({ ...f, level: level(f.rule) })).sort(order);
  const shown = all.filter((f) => atOrAbove(f.level, minSeverity));
  const hidden = all.length - shown.length;
  const perRule = new Map();
  const findings = [];
  let cut = 0;
  for (const f of shown) {
    const n = (perRule.get(f.rule) ?? 0) + 1;
    perRule.set(f.rule, n);
    if (n > limits.maxFindingsPerRule) cut += 1;
    else {
      const rule = RULES.find((r) => r.id === f.rule);
      const file = safeText(f.file);
      findings.push({
        rule: f.rule,
        level: f.level,
        file,
        line: f.line,
        column: f.column,
        at: `${file}:${f.line}`,
        kind: f.kind,
        artifact: safeText(f.artifact, 200),
        artifactAt: f.artifactLine ? `${file}:${f.artifactLine}` : '',
        found: safeText(f.found, 800),
        fix: rule.fix,
        basis: rule.basis.map((k) => ({ text: POINTS[k].text, source: pointPage(k).title, url: pointPage(k).url })),
        own: rule.own
      });
    }
  }
  // The result counts every finding at or above the minimum severity, including the ones past the limit of a rule.
  const result = decide(shown, failOn);
  const notes = [];
  for (const d of folders) {
    if (d.skipped.length) notes.push(`${d.folder}: ${plural(d.skipped.length, 'file')} whose name does not end in .xml ${d.skipped.length === 1 ? 'was' : 'were'} not read: ${listText(d.skipped.map((x) => `"${x}"`), 6)}`);
    if (d.subfolders) notes.push(`${d.folder}: ${plural(d.subfolders, 'folder')} inside it ${d.subfolders === 1 ? 'was' : 'were'} not walked; name ${d.subfolders === 1 ? 'it' : 'them'} to read ${d.subfolders === 1 ? 'it' : 'them'}`);
  }
  if (files.length && !artifacts.length) notes.push('no receive location, send port, orchestration or party was found in the binding files');
  if (cut) notes.push(`${plural(cut, 'finding')} past the limit of ${grouped(limits.maxFindingsPerRule)} per rule ${cut === 1 ? 'is' : 'are'} counted but not listed`);
  if (hidden) notes.push(`${plural(hidden, 'finding')} below ${minSeverity} ${hidden === 1 ? 'is' : 'are'} not shown`);
  const off = RULES.filter((r) => r.key !== null && levelOf(r, config) === 'off');
  if (off.length) notes.push(`${plural(off.length, 'rule')} ${off.length === 1 ? 'is' : 'are'} off: ${off.map((r) => r.id).join(', ')}`);
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.level] += 1;
  const owned = new Map();
  for (const f of shown) {
    const key = `${f.file}
${f.artifactLine}
${f.artifact}`;
    owned.set(key, [...(owned.get(key) ?? []), `${f.level} ${f.rule}`]);
  }
  const of = (a) => owned.get(`${a.file}
${a.line}
${a.name}`) ?? [];
  const rows = new Map(files.map((f) => [f.file, f]));
  return {
    tool: 'biztalk-binding-inventory',
    version,
    input: {
      paths: files.map((f) => safeText(f.file)),
      folders: folders.map((d) => cleanTexts({ folder: d.folder, files: d.files, skipped: d.skipped.length, subfolders: d.subfolders })),
      files: [...rows.values()].map((f) => ({ file: safeText(f.file), read: f.read, encoding: f.encoding ?? null, artifacts: f.artifacts.length }))
    },
    config: {
      file: config.file === null ? null : safeText(config.file),
      name: config.name === null ? null : safeText(config.name, 120),
      adapterTargets: cleanTexts(config.adapterTargets),
      targetCount: config.targetCount,
      builtInPrefixes: cleanTexts(config.builtInPrefixes),
      secretNames: cleanTexts(config.secretNames),
      weights: config.weights,
      bands: config.bands,
      minSeverity,
      failOn,
      rules: RULES.map((r) => ({ id: r.id, key: r.key, level: levelOf(r, config), rule: safeText(r.rule(config), 600) }))
    },
    summary: cleanTexts(summary),
    artifacts: artifacts.map((a) => shownArtifact(a, of(a))),
    findings,
    totals: { findings: shown.length, byLevel, hidden, notListed: cut },
    result,
    notes: notes.map((n) => safeText(n, 600)),
    notice: NOTICE
  };
}

// Reads the configuration and the binding files named and checks them: the report object of the run.
export async function checkPaths({ inputs, config: configPath = null, minSeverity = null, failOn = null, version = '0.0.0', limits = LIMITS, base = process.cwd() }) {
  let config;
  try {
    if (configPath) {
      const c = await readTextFile(configPath, base, limits.maxConfigBytes);
      config = readConfig(c.text, c.file);
    } else config = defaultConfig();
  } catch (error) {
    if (error instanceof ConfigError) throw new InputError(capped(error.problems));
    throw new InputError([error.message]);
  }
  config.xmlLimits = xmlLimitsOf(limits);
  const problems = [];
  const seen = new Set();
  const given = [];
  const folders = [];
  const take = (g) => {
    if (seen.has(g.full)) {
      problems.push(`${g.shown}: is named twice`);
      return;
    }
    seen.add(g.full);
    given.push(g);
  };
  for (const path of inputs) {
    let g;
    try {
      g = await inspectPath(path, base);
      if (g.folder) {
        const list = await listFolder(g.full, g.shown, limits.maxFolderFiles);
        folders.push({ folder: g.shown, files: list.files.length + list.links.length, skipped: list.skipped, subfolders: list.folders });
        for (const f of list.files) take({ ...f, link: false });
        for (const l of list.links) take({ full: `${g.full}\n${l}`, shown: l, link: true });
        continue;
      }
    } catch (error) {
      problems.push(error.message);
      continue;
    }
    if (fileKind(g.shown) === null) {
      problems.push(`${g.shown}: not a kind of file the tool reads (a binding file whose name ends in .xml, or a folder of them)`);
      continue;
    }
    take({ ...g, link: false });
  }
  if (problems.length) throw new InputError(capped(problems));
  const files = [];
  let total = 0;
  for (const g of given) {
    if (g.link) {
      files.push(unreadableBinding(g.shown, 'unreadable-file', 1, 1, 'the file cannot be read: is a symbolic link, which is not followed; nothing in it is checked'));
      continue;
    }
    let read;
    try {
      read = await readText(g.full, g.shown, limits.maxFileBytes);
    } catch (error) {
      files.push(unreadableBinding(g.shown, 'unreadable-file', 1, 1, `the file cannot be read: ${error.reason ?? error.message}; nothing in it is checked`));
      continue;
    }
    total += read.size;
    if (total > limits.maxTotalBytes) throw new InputError([`${g.shown}: the files read so far hold more than ${grouped(limits.maxTotalBytes)} bytes, the limit of one run`]);
    files.push({ ...readBinding(read.text, g.shown, config), encoding: read.encoding });
  }
  return buildReport({ files, folders, config, minSeverity: minSeverity ?? config.minSeverity, failOn: failOn ?? config.failOn, version, limits });
}
