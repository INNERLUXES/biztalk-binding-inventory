import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADAPTER_TARGETS, BUILT_IN_PREFIXES, COMPLEXITY_BANDS, CONFIG_LIMITS, ConfigError, DEFAULT_FAIL_ON, DEFAULT_MIN_SEVERITY, DEFAULT_RULES, DEFAULT_WEIGHTS, KEYS, RULES, defaultConfig, defaultTargets, defaultsAsConfig, distance, isObject, kindOf, readConfig, suggestion, validateConfig } from '../src/index.js';

// The configuration file: every key with a good value and a bad one, the suggestions, and the defaults.

const problems = (text) => {
  try {
    readConfig(text, 'c.json');
  } catch (error) {
    assert.ok(error instanceof ConfigError, error.message);
    return error.problems;
  }
  return assert.fail('not refused');
};

test('config: the defaults, and --print-defaults read back gives them', () => {
  const d = defaultConfig();
  assert.deepEqual(d.rules, DEFAULT_RULES);
  assert.deepEqual(d.weights, DEFAULT_WEIGHTS);
  assert.deepEqual(d.bands, COMPLEXITY_BANDS);
  assert.deepEqual(d.builtInPrefixes, BUILT_IN_PREFIXES);
  assert.deepEqual(d.secretNames, []);
  assert.deepEqual([d.minSeverity, d.failOn], [DEFAULT_MIN_SEVERITY, DEFAULT_FAIL_ON]);
  assert.equal(d.targetCount, ADAPTER_TARGETS.reduce((n, e) => n + e.adapters.length, 0));
  assert.equal(defaultTargets().get('wcf-sql').target, 'Logic Apps SQL Server connector');
  const back = readConfig(JSON.stringify(defaultsAsConfig()), 'd.json');
  assert.deepEqual([...back.targets.entries()], [...d.targets.entries()]);
  assert.deepEqual({ ...back, file: null, name: null, adapterTargets: {}, targets: null }, { ...d, targets: null });
  assert.deepEqual(Object.keys(defaultsAsConfig()), ['name', ...Object.keys(KEYS).filter((k) => k !== 'name')]);
  for (const r of RULES.filter((x) => x.key)) assert.ok(Object.hasOwn(DEFAULT_RULES, r.key), r.key);
  assert.equal(Object.keys(DEFAULT_RULES).length, RULES.filter((x) => x.key).length);
});

test('config: every key with a good value', () => {
  const c = readConfig(JSON.stringify({ name: 'Review', rules: { orchestration: 'off', duplicateAddress: 'warning' }, adapterTargets: { 'WCF-NetTcp': ' Azure Relay ', ' FILE ': 'Azure Files' }, builtInPrefixes: ['Contoso.Shared.'], secretNames: ['Pin Code', 'pincode'], weights: { orchestration: 8, map: 0 }, minSeverity: 'warning', failOn: 'warning' }), 'c.json');
  assert.equal(c.file, 'c.json');
  assert.equal(c.name, 'Review');
  assert.equal(c.rules.orchestration, 'off');
  assert.equal(c.rules.duplicateAddress, 'warning');
  assert.deepEqual(c.adapterTargets, { 'WCF-NetTcp': 'Azure Relay', FILE: 'Azure Files' });
  assert.equal(c.targets.get('wcf-nettcp').target, 'Azure Relay');
  assert.equal(c.targets.get('file').target, 'Azure Files', 'a target of the configuration replaces the built-in one');
  assert.equal(c.targetCount, defaultConfig().targetCount + 1);
  assert.deepEqual(c.builtInPrefixes, [...BUILT_IN_PREFIXES, 'Contoso.Shared.']);
  assert.deepEqual(c.secretNames, ['pincode']);
  assert.equal(c.weights.orchestration, 8);
  assert.equal(c.weights.map, 0);
  assert.deepEqual([c.minSeverity, c.failOn], ['warning', 'warning']);
});

test('config: an unknown key is an error with its line and a suggestion', () => {
  assert.deepEqual(problems('{\n  "failOm": "info",\n  "rules": {\n    "orchestrations": "off"\n  }\n}'), ['c.json: line 2: "failOm" is not a key of the configuration; did you mean "failOn"?', 'c.json: line 4: "orchestrations" is not a key of rules; did you mean "orchestration"?']);
  assert.deepEqual(problems('{"adapterTarget": {}}'), ['c.json: line 1: "adapterTarget" is not a key of the configuration; did you mean "adapterTargets"?']);
  assert.deepEqual(problems('{"weights": {"mapp": 1}}'), ['c.json: line 1: "mapp" is not a key of weights; did you mean "map"?']);
  assert.deepEqual(problems('{"colour": 1}'), ['c.json: line 1: "colour" is not a key of the configuration']);
});

test('config: a value of the wrong kind for every key', () => {
  assert.deepEqual(problems('[]'), ['c.json: line 1: the configuration must be a JSON object, not a list']);
  assert.match(problems('{"name": " "}')[0], /name must be a text of 1 to 120 characters/);
  assert.match(problems('{"rules": []}')[0], /rules must be an object, not a list/);
  assert.match(problems('{"rules": {"orchestration": "fatal"}}')[0], /rules\.orchestration must be one of info, warning, error, off, not "fatal"/);
  assert.match(problems('{"rules": {"orchestration": 1}}')[0], /not 1/);
  assert.match(problems('{"weights": 3}')[0], /weights must be an object, not a number/);
  for (const v of ['-1', '1.5', '101', '"5"', 'null']) assert.match(problems(`{"weights": {"map": ${v}}}`)[0], /weights\.map must be a whole number from 0 to 100/, v);
  assert.match(problems('{"adapterTargets": []}')[0], /adapterTargets must be an object of adapter names to targets, not a list/);
  assert.match(problems('{"adapterTargets": {"X": ""}}')[0], /adapterTargets\.X must be a text of 1 to 200 characters that names the target, not ""/);
  assert.match(problems('{"adapterTargets": {"X": 1}}')[0], /not a number/);
  assert.match(problems('{"adapterTargets": {" ": "y"}}')[0], /the adapter name " " must hold 1 to 200 characters/);
  assert.match(problems('{"adapterTargets": {"wcf-sql": "a", "WCF-SQL": "b"}}')[0], /"WCF-SQL" is the same adapter as "wcf-sql" once compared \(wcf-sql\)/);
  const many = Object.fromEntries(Array.from({ length: CONFIG_LIMITS.maxEntries + 1 }, (_, i) => [`a${i}`, 'x']));
  assert.match(problems(JSON.stringify({ adapterTargets: many }))[0], /adapterTargets holds more than 500 adapters/);
  assert.match(problems('{"builtInPrefixes": "Contoso."}')[0], /builtInPrefixes must be a list of texts, not a string/);
  assert.match(problems('{"builtInPrefixes": [" "]}')[0], /builtInPrefixes\[0\] must be a text of 1 to 200 characters/);
  assert.match(problems('{"secretNames": ["--"]}')[0], /secretNames\[0\] must be a text of 1 to 100 characters with a letter or a digit, not "--"/);
  assert.match(problems(JSON.stringify({ secretNames: Array.from({ length: 501 }, (_, i) => `s${i}`) }))[0], /secretNames holds more than 500 entries/);
  assert.match(problems('{"minSeverity": "fatal"}')[0], /minSeverity must be one of info, warning, error/);
  assert.match(problems('{"failOn": null}')[0], /failOn must be one of info, warning, error/);
});

test('config: a repeated name and JSON that does not parse are refused, and the problems are in the order of their lines', () => {
  assert.match(problems('{"failOn": "info", "failOn": "error"}')[0], /^c\.json: line 1, column 20: the name "failOn" appears twice/);
  assert.match(problems('{"failOn": "info",}')[0], /^c\.json: line 1, column 19: a comma before the closing brace/);
  assert.deepEqual(problems('{\n"failOn": 1,\n"minSeverity": 2,\n"zz": 3\n}').map((p) => p.split(':')[1].trim()), ['line 2', 'line 3', 'line 4']);
});

test('config: suggestions, edit distance and the kinds of values', () => {
  assert.equal(distance('nmae', 'name'), 1);
  assert.equal(distance('', 'abc'), 3);
  assert.equal(distance('kitten', 'sitting'), 3);
  assert.equal(suggestion('weigths', ['weights', 'rules']), '; did you mean "weights"?');
  assert.equal(suggestion('x', ['rules']), '');
  assert.equal(suggestion('y'.repeat(65), ['rules']), '');
  assert.equal(kindOf(null), 'null');
  assert.equal(kindOf([]), 'a list');
  assert.equal(kindOf({}), 'an object');
  assert.equal(kindOf(1), 'a number');
  assert.equal(isObject({}), true);
  assert.equal(isObject([]), false);
  assert.throws(() => validateConfig(1), /the configuration must be a JSON object, not a number/);
  assert.deepEqual(validateConfig({}).rules, DEFAULT_RULES);
});
