// The built-in configuration: the level of every rule, the weights of the complexity score, the lowest level shown and
// the level that fails the run. docs/inputs.md describes every key, and --print-defaults writes all of this out. The
// adapter targets are in src/targets.js.

// The level of every rule that the configuration can set. The three rules of input problems are always errors.
export const DEFAULT_RULES = {
  unmappedAdapter: 'warning',
  customPipeline: 'warning',
  orchestration: 'info',
  orphanSendPort: 'warning',
  disabledReceiveLocation: 'info',
  duplicateAddress: 'error',
  plainTextCredential: 'error',
  dynamicSendPort: 'warning'
};

// The weights of the complexity score of an artifact: a base for its kind, and an amount for each thing that adds work
// to its move. docs/method.md says how they add up.
export const DEFAULT_WEIGHTS = {
  receiveLocation: 1,
  sendPort: 1,
  orchestration: 5,
  party: 2,
  orchestrationPort: 1,
  unmappedAdapter: 3,
  customPipeline: 3,
  customComponent: 2,
  map: 1,
  filterStatement: 1,
  twoWay: 1,
  dynamicSendPort: 2,
  b2b: 3,
  backupTransport: 1
};

// A score up to low is low, up to medium is medium, and above it is high.
export const COMPLEXITY_BANDS = { low: 3, medium: 7 };

// The lowest level of a finding that is shown.
export const DEFAULT_MIN_SEVERITY = 'info';

// The lowest level of a finding that fails the run.
export const DEFAULT_FAIL_ON = 'error';
