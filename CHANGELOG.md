# Changes

## 1.0.0

First release.

- Reads BizTalk Server binding files, the XML exported for an application, an assembly or a group: one or more files,
  or folders read one level deep for their files ending in `.xml`, as UTF-8 or as UTF-16 after a byte order mark.
- Lists every receive location, send port, orchestration and party with its application, adapter (and backup
  adapter), address, receive port, pipelines with their custom components, maps, filters, bound ports or send ports,
  a suggested Azure target and a complexity score, with a summary per application, per adapter and per target.
- The suggested targets as a documented data file (`src/targets.js`): FILE, FTP, SFTP, HTTP, SOAP and the HTTP WCF
  adapters, WCF-SQL, MQSeries, SB-Messaging, SAP, MSMQ, SMTP, POP3, Windows SharePoint Services and the Logic App
  adapter, plus targets for orchestrations, parties, custom pipeline code, EDI and AS2 pipelines and dynamic send ports.
  `adapterTargets` in the configuration adds or replaces an entry.
- Every address is masked when it is read, and no value of a setting named like a password, secret, key or token, no
  password of an address and no secret part of a connection string reaches any output.
- Its own XML reader, with no dependency: a DOCTYPE or ENTITY declaration and any entity but the five XML predefines
  are refused, so no external entity is read and no entity expands, and the depth, the elements, the attributes and
  the text are limited.
- Eight rules in three levels: adapters with no mapped target (`unmapped-adapter`), custom pipelines and components
  (`custom-pipeline`), orchestrations to redesign (`orchestration`), send ports that nothing feeds
  (`orphan-send-port`), disabled receive locations (`disabled-receive-location`), duplicate addresses
  (`duplicate-address`), credentials in plain text (`plain-text-credential`) and dynamic send ports
  (`dynamic-send-port`); and three rules of input problems that cannot be lowered (`invalid-artifact`,
  `unreadable-file`, `unparsable-file`).
- A complexity score per artifact from documented weights, with low, medium and high bands.
- A configuration file in strict JSON over documented defaults: the level of every rule, `adapterTargets`,
  `builtInPrefixes`, `secretNames`, `weights`, the minimum severity and the level that fails the run; a key the tool
  does not know is an error with its line and a suggestion, and a key named twice is refused.
- Reports as text, JSON, a CSV inventory with one row per artifact (`--format csv`) and GitHub workflow commands
  (`--format github`) that show each finding as an annotation; `--min-severity`, `--fail-on`, `--explain` with the rule,
  the sources and the parts of each score, and `--print-defaults`. Exit code `0` when no finding is at or above the
  fail-on level, `1` when one is, `2` for a usage or input error, with no result.
- Reads no clock, follows no symbolic link, connects to nothing, runs nothing, writes nothing to disk, reports binary
  and invalid input as errors, neutralizes formulas in the CSV inventory, and has a size limit on every input.
- An inventory, not a migration plan and not a certification: every report says so.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
