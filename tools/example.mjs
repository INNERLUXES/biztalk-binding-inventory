// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// applications to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const MESSY = ['examples/messy', '--config', 'examples/config.json'];
export const CLEAN = ['examples/clean/Tamberly.Invoicing.BindingInfo.xml'];
const FILE = 'examples/messy/Quillmoor.Orders.BindingInfo.xml';

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the messy application: the counts, one finding of every rule that fires, the masked
// credentials, the notes and the result.
export const EXPECTED = [
  'input: 1 binding file from 1 folder (examples/messy): 1 read (1 UTF-8), 0 not read',
  'config: examples/config.json (Quillmoor migration review): 23 adapters with a target (1 from the configuration); minimum severity info; fail on error',
  'artifacts: 14 in 1 application: 4 receive locations, 8 send ports, 1 orchestration, 1 party; complexity 56 (7 low, 6 medium, 1 high)',
  'findings: 10 (3 error, 5 warning, 2 info)',
  '  Quillmoor.Telex  1          no mapped target',
  'address: ftp://qm_orders:****@ftp.ridgeback.test/inbound/',
  'the send port "SP_WarehouseSql" holds a value for Password in plain text, in its TransportTypeData; the value is shown here as ****',
  'the send port "SP_PartnerFtp" holds the password in the user information of an address in plain text, in its Address',
  `the receive location "RL_Orders_File_Old" uses the same FILE address (C:\\Quillmoor\\Drop\\Orders\\*.csv) as the receive location "RL_Orders_File" at ${FILE}:157`,
  'the send port "SP_ArchiveFile" uses the custom send pipeline Quillmoor.Orders.Pipelines.ZipTransmit, which is code to rewrite',
  'the custom component Quillmoor.Components.HeaderStripper in the settings of the receive pipeline',
  'the send port "SP_LegacyAudit" has no filter, no orchestration port names it and it is in no send port group with a filter',
  'the send port "SP_DynamicStatus" is dynamic: its adapter and address are set at run time',
  'the send port "SP_Telex" uses the adapter "Quillmoor.Telex", which has no mapped Azure target',
  'the orchestration "Quillmoor.Orders.Processes.ApproveOrder" (1 of 1 in Quillmoor.Orders) is bound to 3 ports',
  'the receive location "RL_Orders_File_Old" is disabled',
  'target: API Management + Logic Apps or Azure Functions + Logic Apps integration account B2B (AS2, X12, EDIFACT)',
  'note: examples/messy: 1 file whose name does not end in .xml was not read: "README.md"',
  'not a migration plan and not a certification',
  'RESULT: FAIL - 3 findings at or above error (3 error, 5 warning, 2 info)'
];
// The password is never shown, a send port bound to the orchestration or with a filter is not an orphan, the WCF-NetTcp
// port that the configuration maps is not unmapped, the built-in FFDasmComp component is not custom, and an FTP
// password left empty by the export is not a credential.
export const UNWANTED = ['plain-text-demo', 'RESULT: PASS', '"SP_WarehouseSql" has no filter', '"SP_DynamicStatus" has no filter', '"SP_StockService" uses the adapter', 'FFDasmComp', '"RL_Orders_Ftp" holds', '"SP_RidgebackAs2" has no filter'];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const messy = await run(MESSY);
  process.stdout.write(messy.out);
  expect('messy application', messy, 1, EXPECTED, UNWANTED);

  const clean = await run(CLEAN);
  expect('clean application', clean, 0, ['input: 1 binding file: 1 read (1 UTF-8), 0 not read', 'artifacts: 3 in 1 application: 1 receive location, 2 send ports, 0 orchestrations, 0 parties; complexity 7 (3 low, 0 medium, 0 high)', 'findings: 0', 'RESULT: PASS - no finding at or above error'], ['  WARNING  ', '  ERROR  ', 'RESULT: FAIL', 'note:']);

  // Without the configuration the WCF-NetTcp send port has no mapped target either.
  expect('messy, built-in configuration', await run(MESSY.slice(0, 1)), 1, ['config: built-in defaults: 22 adapters with a target', 'the send port "SP_StockService" uses the adapter "WCF-NetTcp", which has no mapped Azure target'], ['plain-text-demo']);
  // Only the errors are shown with --min-severity error.
  expect('messy, errors only', await run([...MESSY, '--min-severity', 'error']), 1, ['findings: 3 (3 error); 7 below error not shown', 'RESULT: FAIL - 3 findings at or above error'], ['WARNING  ', 'INFO     ']);
  // The clean application passes when every level fails the run.
  expect('clean, fail on info', await run([...CLEAN, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // A file of no kind the tool reads stops the run.
  expect('messy, a README named', await run(['examples/messy/README.md']), 2, ['examples/messy/README.md: not a kind of file the tool reads'], [], 'err');

  // The README shows the whole report of the messy application, the --explain lines of one finding, the GitHub
  // annotations of two findings, the start of the CSV inventory and the report of the clean application.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  if (!readme.includes(messy.out)) problems.push('README: the sample output of the messy application differs from a real run');
  if (!readme.includes(clean.out)) problems.push('README: the sample output of the clean application differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/messy.txt'), messy.out);
  await writeFile(resolve(root, 'examples/output/clean.txt'), clean.out);
  const explain = await run([...MESSY, '--explain']);
  if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
  const lines = explain.out.split('\n');
  const at = lines.findIndex((l) => l.includes('plain-text-credential') && l.includes(`${FILE}:36`));
  const sample = lines.slice(at, at + 7).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the --explain sample of the plain-text credential differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-explain.txt'), explain.out);
  const github = await run([...MESSY, '--format', 'github']);
  if (github.code !== 1) problems.push(`github: exit code ${github.code}, expected 1`);
  const picked = github.out.split('\n').filter((x) => x.includes('title=biztalk-binding-inventory duplicate-address::') || x.includes('title=biztalk-binding-inventory dynamic-send-port::'));
  if (picked.length !== 2) problems.push('github: the sample lines are not in the output');
  for (const l of picked) if (!readme.includes(l)) problems.push('README: the GitHub sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-github.txt'), github.out);
  const csv = await run([...MESSY, '--format', 'csv']);
  if (csv.code !== 1) problems.push(`csv: exit code ${csv.code}, expected 1`);
  const head = csv.out.split('\r\n').slice(0, 5).join('\n');
  if (!readme.includes(head)) problems.push('README: the CSV sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-inventory.csv'), csv.out);
  const json = await run([...MESSY, '--json', '--explain']);
  if (json.code !== 1) problems.push(`json: exit code ${json.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output/messy.json'), json.out);
  const defaults = await run(['--print-defaults']);
  if (defaults.code !== 0) problems.push(`--print-defaults: exit code ${defaults.code}, expected 0`);
  await writeFile(resolve(root, 'examples/output/defaults.json'), defaults.out);
  for (const [name, r] of [['messy', messy], ['explain', explain], ['github', github], ['csv', csv], ['json', json]]) if (r.out.includes('plain-text-demo')) problems.push(`${name}: a password from the example is in the output`);

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
