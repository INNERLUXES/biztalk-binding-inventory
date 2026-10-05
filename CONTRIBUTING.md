# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux,
Windows and macOS with Node 22 and 24, the tests with coverage, the repository checks, CodeQL, and a secure
development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`,
with `!` for a breaking change.

This tool builds an inventory from binding files; it is not a migration plan and not a certification. A change must
keep it that way: a rule reports what the binding files say or do not say, a target stays a suggestion, and the tool
never decides how an application should be built in Azure.

## Changing a rule

1. Describe the change in docs/method.md first: what the rule looks at and what it can and cannot see, and add what it
   cannot see to docs/limits.md. Where the tool makes its own choice, say so in `own` in src/rules.js and say why.
2. Keep the rules to what is written. A finding must point at something a reader can check in a file: an element or
   an attribute at a line. Never add a rule that guesses what an assembly, a map or a run does.
3. A rule says what to change, in `fix` in src/rules.js, and names the points of the public pages it rests on in
   `basis`; a new page goes into src/data.js and research/sources.md.
4. A run must never pass because something could not be read: a file that cannot be read or parsed and an artifact
   that cannot be read are error findings, and the three rules of input problems keep no key in the configuration.
5. Add a test with the binding file written inline (`bindingXml()`, `SP()`, `RP()`, `checkOf()` and `reportOf()` in
   test/helpers.js), small enough to work out by hand, with a near miss on each side: the form that is reported and the
   form next to it that is not.
6. A rule id, once released, keeps its meaning: pipelines and other tools read it from the JSON output and the GitHub
   annotations.

## Changing a target

1. src/targets.js holds the suggested target of each adapter and kind of artifact, with the points it rests on. A new
   adapter is named as the `TransportType` of a binding file names it, gets a test, and goes into docs/inputs.md and
   docs/rules-and-sources.md.
2. An adapter whose use depends on its settings, such as `WCF-Custom`, has no entry; a team gives it a target with
   `adapterTargets`.
3. An adapter with no entry is reported, never matched to a near name.

## Changing the readers

1. The XML reader reads each character once with a stack and no recursion, and refuses a DOCTYPE, an ENTITY
   declaration and every entity but the five XML predefines, with the line and column
   ([decision 3](docs/decisions/0003-read-xml-with-its-own-reader-and-no-document-type-definition.md)). A new form gets
   a test of the form itself and of the same form left open or broken, and a hostile test with a time check.
2. A new element read goes into src/bindings.js, docs/inputs.md and the README.
3. A time check in a test widens under coverage: read `process.env.NODE_V8_COVERAGE`, which the test runner sets only
   when coverage is on, and allow four times the time. Never read the flags of the process for this, because they hold
   the coverage flags of the runner in every run. Run `npm run test:coverage` before you open the pull request.
4. A file written with LF, CRLF or CR line ends, with or without a byte order mark, as UTF-8 or UTF-16, must give the
   same output. The example files are stored as written (`.gitattributes`), and a test reads them with CRLF line ends.

## Changing what counts as a secret

1. src/secrets.js holds the parts and endings of the names of secrets and the endings that are not. A change gets a
   test of the name itself and of the name next to it that must not match.
2. No value found is ever shown: not in a finding, an address, a filter or an error message
   ([decision 2](docs/decisions/0002-mask-every-credential-and-never-print-a-secret.md)). A test writes a password in
   every place a binding file can hold one and looks for it in every format.

## Changing the configuration file

1. A new key is added to `KEYS` in src/config.js, documented in docs/inputs.md and tested with a good value and a bad
   one. Every key the tool does not know stays an error, and a key named twice stays refused.
2. Never add a key that takes a regular expression, and never one that shows a masked value.

## Changing a source

1. Every point the reports show is in src/data.js, written in this project's own words, with the page it comes from. A
   short phrase of a page may be named; a long quotation may not.
2. research/sources.md lists every page with a note on what it says, and docs/rules-and-sources.md lists every rule
   and target with its points and what to change. A test checks all three against each other. Fetch and read a page
   before it is listed, and leave out a web address that holds a number that reads like a year.

## Tests that depend on the system

A test that depends on the operating system (a symbolic link, a device, file permissions, a character that a file name
cannot hold on every system) is guarded with `process.platform`, says why in its `t.skip`, and asserts no line of its
own: a line is asserted only in a test that runs on every system, and is worked out there with `lineOf()` of
test/helpers.js or from the text itself, never written by hand. `test/repo.test.js` fails when a guarded test asserts a
line. Every other test builds its paths with `resolve()` from names with forward slashes.

A test never reads the clock, the time zone of the machine or the locale.

## Rules for the code

- No runtime dependencies and no development dependencies. Node 22 or newer and nothing else; the tests use `node:test`.
- The tool reads the files and the configuration it is given and writes only to standard output and standard error. It
  opens no network connection, runs no program and evaluates nothing it reads.
- Text from the input, file names included, goes through `safeText` before it reaches the output or an error message.
- Source files stay ASCII; write any other character as a Unicode escape, or build it from its code point.
- Never commit a real secret, even as a fixture. `npm run check` fails on anything that looks like a credential, and
  the passwords of the examples and the tests are made up and short.
- No prose file carries a date, and no file holds a number that reads like a year. Version numbers (Node 22, RFC 4180,
  1.0.0) are fine; the years of product releases are left out.
- Examples and tests use made-up companies, applications, hosts and data, never the bindings of a real organisation,
  and never a sample copied from the product documentation.
- Plain words in the documents: `npm run check` fails on a short list of words that say little.

## Before you open the pull request

```
npm test
npm run test:coverage
npm run check
npm run example
```
