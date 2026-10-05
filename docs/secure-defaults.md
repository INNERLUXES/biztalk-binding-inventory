# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which files you give it, where the output goes, and who may
change the binding files and the configuration. The inventory is not a migration plan and not a certification; a
passing run is a set of binding files with none of the problems the rules look for, not a finding that an application
is ready to move.

## How the tool behaves by default

- **Reads, never follows.** The tool reads the files and the folders it is given, one level deep, and the configuration
  named with `--config`. It follows no symbolic link, fetches no web address, refuses an argument that looks like an
  address, connects to none of the hosts the binding files name, evaluates nothing, starts no program and writes
  nothing to disk.
- **No document type definition.** The XML reader is the tool's own and refuses a DOCTYPE or ENTITY declaration and any
  entity but the five XML predefines, so no external entity is fetched and no entity expands
  ([decision 3](decisions/0003-read-xml-with-its-own-reader-and-no-document-type-definition.md)).
- **No secret in the output.** Every address is masked when it is read, a filter value whose property is the name of a
  secret is masked, and a credential found in plain text is reported by the name of its setting, never by its value
  ([decision 2](decisions/0002-mask-every-credential-and-never-print-a-secret.md)).
- **Every rule on from the first run.** A credential in plain text and a duplicate address are errors; an unmapped
  adapter, a custom pipeline, an orphan send port and a dynamic send port are warnings; an orchestration and a disabled
  receive location are information.
- **Fail closed on what it cannot read.** A file that cannot be read, a file the reader refuses and an artifact that
  cannot be read are error findings that fail the run at the default `failOn` of `error`; these three rules have no key
  and cannot be lowered or set off. A path that cannot be used stops the run with exit code `2` and no result.
- **No guesses.** An adapter with no entry has no mapped target and a finding; it is never matched to a near name.
- **Unknown keys are errors.** A key in the configuration that the tool does not know stops the run, with its line and
  a suggestion, so a typo such as `failOm` cannot leave a default in place. A key named twice stops the run.
- **No regular expression from the input.** No pattern is built from the binding files or the configuration.
- **No prototype tricks.** Objects are built with own properties and names are looked up in maps or with
  `Object.hasOwn`, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names included, has control characters, line separators and direction
  controls removed and its length capped before it reaches a report or an error message. The GitHub format escapes
  `%`, CR and LF in a message and also `:` and `,` in a property. The CSV format puts a single quote in front of a field
  that a spreadsheet could read as a formula.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`"failOn": "warning"`.** Unmapped adapters, custom pipelines, orphan and dynamic send ports fail the run too. Use it
  once every adapter has a target.
- **`secretNames`.** Add the names your custom adapters give their secrets.
- **All the files of a group in one run.** An orphan or a duplicate address across applications is only found when
  their files are read together.
- **Keep `adapterTargets` and `builtInPrefixes` short.** A target hides an `unmapped-adapter` finding, and a prefix
  hides a `custom-pipeline` finding; review each one.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: BizTalk binding inventory
    run: npx --yes github:INNERLUXES/biztalk-binding-inventory bindings/ --config bindings/migration.json --format github
```

- Give the job read access to the contents and nothing more. The tool needs no secret and no network access to your
  BizTalk group.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Do not hide the exit code with a trailing `|| true`. To list the inventory without failing, keep `failOn` at `error`
  and keep the JSON report or the CSV inventory as an artifact of the job.
- Take every credential out of a binding file before it is committed, and rotate one that was. The tool masks what it
  finds; the file in the repository still holds it.
- Treat a CSV inventory built from files you do not trust as untrusted data: open it with formulas off.

## Protecting the binding files and the configuration

The binding files decide the inventory, and the configuration decides which rules report, which adapters have a
target and what fails the run. Keep them in the repository, put their paths in `CODEOWNERS` with the people who own the
migration, and require their review in branch protection. Review a change that sets a rule to off or lower, adds a
target or a built-in prefix, or raises `failOn` like a change to code: each of them can hide a gap.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
