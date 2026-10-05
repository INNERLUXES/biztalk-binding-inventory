// The inventory as CSV, written as RFC 4180 describes it: a header line, records ended by CRLF, and a field that holds a
// comma, a double quote or a line break put in double quotes with every double quote inside written twice. One record
// per artifact, in the order of the report, and one record of the kind "file" for each file with findings that belong
// to no artifact, such as a file the reader refuses. A field that starts with =, +, -, @, a tab or a carriage return
// gets a single quote in front, so a spreadsheet does not read a name from the input as a formula;
// docs/threat-model.md says why that is a help and not a guarantee.

export const CSV_COLUMNS = ['kind', 'name', 'application', 'adapter', 'address', 'target', 'complexity', 'findings'];

const FORMULA = /^[=+\-@\t\r]/;

// One field: text with a leading formula character neutralized, quoted when it must be.
export function csvField(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const record = (cells) => cells.map(csvField).join(',');

// The inventory as CSV. The texts come from the report object, where safeText cleaned them and the addresses were
// masked.
export function toCsv(r) {
  const rows = [CSV_COLUMNS.join(',')];
  for (const a of r.artifacts) {
    const adapter = a.dynamic ? 'dynamic' : [a.adapter, ...(a.backupAdapter ? [`backup ${a.backupAdapter}`] : [])].filter((x) => x !== '').join('; ');
    rows.push(record([a.kind, a.name, a.application, adapter, a.address, a.target, a.complexity, a.findings.join('; ')]));
  }
  const listed = new Set(r.artifacts.map((a) => a.at));
  const loose = new Map();
  for (const f of r.findings) {
    if (f.artifactAt !== '' && listed.has(f.artifactAt)) continue;
    loose.set(f.file, [...(loose.get(f.file) ?? []), `${f.level} ${f.rule}`]);
  }
  for (const [file, list] of loose) rows.push(record(['file', file, '', '', '', '', '', list.join('; ')]));
  return `${rows.join('\r\n')}\r\n`;
}
