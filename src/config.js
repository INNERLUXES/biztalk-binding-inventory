// The configuration file: the settings of the tool, in one strict JSON object over the built-in defaults. Every key the
// tool does not know is an error with its line and a suggestion, so a typo cannot leave a default in place unnoticed;
// the JSON reader refuses a name given twice in one object. The configuration is optional: with none, the defaults
// apply.

import { LEVELS } from './data.js';
import { COMPLEXITY_BANDS, DEFAULT_FAIL_ON, DEFAULT_MIN_SEVERITY, DEFAULT_RULES, DEFAULT_WEIGHTS } from './defaults.js';
import { JsonError, jsonProblem, parseJson } from './json.js';
import { ADAPTER_TARGETS, BUILT_IN_PREFIXES } from './targets.js';
import { adapterForm, asciiLower, fieldForm } from './words.js';

export const CONFIG_LIMITS = { maxEntries: 500, maxNameLength: 200, maxTargetLength: 200, maxWeight: 100 };

// Every key of the configuration file, with the kind of its value. docs/inputs.md describes each of them.
export const KEYS = {
  name: 'text',
  rules: Object.fromEntries(Object.keys(DEFAULT_RULES).map((k) => [k, 'level or off'])),
  adapterTargets: 'object of adapter names to targets',
  builtInPrefixes: 'list of texts',
  secretNames: 'list of texts',
  weights: Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((k) => [k, 'whole number'])),
  minSeverity: 'level',
  failOn: 'level'
};

export class ConfigError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

// The edit distance of two short names, for a suggestion: an insertion, a deletion, a change or two neighbours swapped
// ("nmae" for "name") each count one.
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// The closest of the known names, when it is close enough to be a typo: '; did you mean "..."?' or nothing. A name that
// differs in length from a known name by more than three characters, or that is longer than 64 characters, is not
// compared with it.
export function suggestion(name, known) {
  if (name.length > 64) return '';
  let best = null;
  for (const k of known) {
    if (Math.abs(name.length - k.length) > 3 || k.length > 64) continue;
    const d = distance(asciiLower(name), asciiLower(k));
    if (d <= Math.max(1, Math.floor(k.length / 3)) && (!best || d < best.d)) best = { k, d };
  }
  return best ? `; did you mean "${best.k}"?` : '';
}

export function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The built-in adapter targets: a map of each adapter in its adapter form to { adapter, target }.
export function defaultTargets() {
  const map = new Map();
  for (const entry of ADAPTER_TARGETS) for (const a of entry.adapters) map.set(adapterForm(a), { adapter: a, target: entry.target });
  return map;
}

// The built-in configuration, as the checks use it.
export function defaultConfig() {
  const targets = defaultTargets();
  return {
    file: null,
    name: null,
    rules: { ...DEFAULT_RULES },
    adapterTargets: {},
    targets,
    targetCount: targets.size,
    builtInPrefixes: [...BUILT_IN_PREFIXES],
    secretNames: [],
    weights: { ...DEFAULT_WEIGHTS },
    bands: { ...COMPLEXITY_BANDS },
    minSeverity: DEFAULT_MIN_SEVERITY,
    failOn: DEFAULT_FAIL_ON
  };
}

// The built-in configuration written as a configuration file, for --print-defaults. Read back, it gives the defaults:
// the adapter targets are written out, and builtInPrefixes and secretNames are empty because they add to the
// built-in lists.
export function defaultsAsConfig() {
  const d = defaultConfig();
  return { name: 'built-in defaults', rules: d.rules, adapterTargets: Object.fromEntries([...d.targets.values()].map((t) => [t.adapter, t.target])), builtInPrefixes: [], secretNames: [], weights: d.weights, minSeverity: d.minSeverity, failOn: d.failOn };
}

// Checks a parsed configuration and builds the configuration the checks use, or throws ConfigError with every problem.
export function validateConfig(value, lines = new Map(), file = 'config') {
  const problems = [];
  const lineOf = (path) => {
    for (let p = path, prev = null; p && p !== prev; prev = p, p = p.replace(/(?:\.[^.[]+|\[\d+\])$/, '')) if (lines.has(p)) return lines.get(p);
    return 1;
  };
  const fail = (path, message) => problems.push({ line: lineOf(path), text: `${file}: line ${lineOf(path)}: ${message}` });
  const config = defaultConfig();
  config.file = file;
  if (!isObject(value)) throw new ConfigError([`${file}: line 1: the configuration must be a JSON object, not ${kindOf(value)}`]);
  const show = (v) => (typeof v === 'string' ? `"${v.slice(0, 40)}"` : kindOf(v));

  const top = Object.keys(KEYS);
  for (const k of Object.keys(value)) if (!top.includes(k)) fail(k, `"${k.slice(0, 60)}" is not a key of the configuration${suggestion(k, top)}`);

  if (Object.hasOwn(value, 'name')) {
    if (typeof value.name !== 'string' || value.name.trim().length === 0 || value.name.length > 120) fail('name', 'name must be a text of 1 to 120 characters');
    else config.name = value.name;
  }

  for (const [key, defaults, check, message] of [
    ['rules', DEFAULT_RULES, (v) => typeof v === 'string' && [...LEVELS, 'off'].includes(v), `one of ${[...LEVELS, 'off'].join(', ')}`],
    ['weights', DEFAULT_WEIGHTS, (v) => Number.isInteger(v) && v >= 0 && v <= CONFIG_LIMITS.maxWeight, `a whole number from 0 to ${CONFIG_LIMITS.maxWeight}`]
  ]) {
    if (!Object.hasOwn(value, key)) continue;
    const v = value[key];
    const keys = Object.keys(defaults);
    if (!isObject(v)) {
      fail(key, `${key} must be an object, not ${kindOf(v)}`);
      continue;
    }
    for (const k of Object.keys(v)) {
      const path = `${key}.${k}`;
      if (!keys.includes(k)) fail(path, `"${k.slice(0, 60)}" is not a key of ${key}${suggestion(k, keys)}`);
      else if (!check(v[k])) fail(path, `${path} must be ${message}, not ${typeof v[k] === 'number' ? String(v[k]) : show(v[k])}`);
      else config[key][k] = v[k];
    }
  }

  if (Object.hasOwn(value, 'adapterTargets')) {
    const v = value.adapterTargets;
    if (!isObject(v)) fail('adapterTargets', `adapterTargets must be an object of adapter names to targets, not ${kindOf(v)}`);
    else if (Object.keys(v).length > CONFIG_LIMITS.maxEntries) fail('adapterTargets', `adapterTargets holds more than ${CONFIG_LIMITS.maxEntries} adapters`);
    else {
      const seen = new Map();
      for (const k of Object.keys(v)) {
        const path = `adapterTargets.${k}`;
        const form = adapterForm(k);
        if (form === '' || k.length > CONFIG_LIMITS.maxNameLength) fail(path, `the adapter name "${k.slice(0, 60)}" must hold 1 to ${CONFIG_LIMITS.maxNameLength} characters`);
        else if (seen.has(form)) fail(path, `"${k.slice(0, 60)}" is the same adapter as "${seen.get(form)}" once compared (${form})`);
        else if (typeof v[k] !== 'string' || v[k].trim() === '' || v[k].length > CONFIG_LIMITS.maxTargetLength) fail(path, `${path} must be a text of 1 to ${CONFIG_LIMITS.maxTargetLength} characters that names the target, not ${show(v[k])}`);
        else {
          seen.set(form, k);
          // Defined as an own property, so a name such as __proto__ is only a name.
          Object.defineProperty(config.adapterTargets, k.trim(), { value: v[k].trim(), enumerable: true, writable: true, configurable: true });
          config.targets.set(form, { adapter: k.trim(), target: v[k].trim() });
        }
      }
      config.targetCount = config.targets.size;
    }
  }

  for (const [key, max, form] of [['builtInPrefixes', 200, (t) => t.trim()], ['secretNames', 100, fieldForm]]) {
    if (!Object.hasOwn(value, key)) continue;
    const v = value[key];
    if (!Array.isArray(v)) {
      fail(key, `${key} must be a list of texts, not ${kindOf(v)}`);
      continue;
    }
    if (v.length > CONFIG_LIMITS.maxEntries) {
      fail(key, `${key} holds more than ${CONFIG_LIMITS.maxEntries} entries`);
      continue;
    }
    v.forEach((x, i) => {
      const path = `${key}[${i}]`;
      if (typeof x !== 'string' || form(x) === '' || x.length > max) fail(path, `${path} must be a text of 1 to ${max} characters with a letter or a digit, not ${show(x)}`);
      else if (!config[key].includes(form(x))) config[key].push(form(x));
    });
  }

  for (const key of ['minSeverity', 'failOn']) {
    if (!Object.hasOwn(value, key)) continue;
    if (!LEVELS.includes(value[key])) fail(key, `${key} must be one of ${LEVELS.join(', ')}`);
    else config[key] = value[key];
  }
  // The problems in the order of their lines, so the list reads like the file.
  if (problems.length) throw new ConfigError(problems.sort((a, b) => a.line - b.line).map((p) => p.text));
  return config;
}

// Reads the text of a configuration file.
export function readConfig(text, file) {
  let parsed;
  try {
    parsed = parseJson(text, { linesUpTo: 3 });
  } catch (error) {
    if (error instanceof JsonError) throw new ConfigError([`${file}: ${jsonProblem(error, text)}`]);
    throw error;
  }
  return validateConfig(parsed.value, parsed.lines, file);
}
