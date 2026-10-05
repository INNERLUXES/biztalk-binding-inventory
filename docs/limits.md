# Limits

The tool reads BizTalk Server binding files as they are written: the XML BizTalk Server exports for an application, an
assembly or a group, with its receive locations, send ports, send port groups, orchestrations and parties. It is an
inventory to start a migration plan from, not a migration plan and not a certification. It connects to no BizTalk
group, no SQL Server database and no Azure service, deploys nothing, and asks nobody anything. A finding points at
something in a file; a target is a suggestion to review; a run without findings says only that the files hold none of
the problems of docs/method.md. Every report ends with a sentence that says so.

## What it cannot see

- **The assemblies.** The logic of an orchestration, the code of a custom pipeline component, the maps and the schemas
  are in the assemblies, which the tool does not read. It counts orchestrations, names pipelines, components and maps,
  and scores them; it cannot tell how hard one is to move.
- **Whether a target fits.** The targets of src/targets.js are a table, not a design. Whether a connector supports the
  operations, the volume, the authentication and the network a port needs, and whether an orchestration should become
  one workflow or several, is for the team to decide; the migration overview on Microsoft Learn says to confirm each
  connector first.
- **What a WCF-Custom port does.** Its binding decides, so it has no mapped target until the configuration gives one.
- **Run time.** A dynamic send port gets its adapter and address at run time; the tool reports it and cannot list them.
  The tool cannot tell whether a port is used, how many messages it carries, or whether a receive location is enabled in
  the group now, only what the export says.
- **Subscriptions outside the files.** A send port is an orphan when nothing in the files of the run feeds it. An
  orchestration of another application, or a send port group in a file not given, may feed it; give all the files of a
  group in one run.
- **Every secret.** The tool finds a value in a setting whose name is that of a secret, a password in an address and a
  secret part of a connection string (docs/method.md). A secret under a name that is not on the list, or inside a value
  of another form, is not found; a name that only looks like a secret may be found. The tool cannot tell whether a
  value is still valid. It never shows a value either way.
- **Custom components in pipelines whose settings were never changed.** The binding file names the components of a
  pipeline only when their properties were set for the port.
- **Time.** The tool reads no clock and no dates
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)), not even the time stamp of an
  export. The end of support of BizTalk Server is on the lifecycle and migration pages.
- **Other formats.** An MSI package, a BizTalk application exported as a package, a `.btproj` project or a binding file
  of another product is not read. A file whose root element is not `BindingInfo` is an `unparsable-file` finding.
- **Namespaces and schemas.** Elements are read by their local names; no namespace is looked up and the file is not
  validated against a schema.
- **XML with a document type definition.** A DOCTYPE or ENTITY declaration is refused, even a harmless one
  ([decision 3](decisions/0003-read-xml-with-its-own-reader-and-no-document-type-definition.md)); export the bindings
  again.

## The readers

- The XML reader reads elements, attributes, text, CDATA sections, comments and processing instructions, and the five
  predefined entities and character references. It refuses everything else with the line and column.
- A file is read as UTF-8, with or without a byte order mark, or as UTF-16 after its byte order mark. A UTF-16 file
  without a byte order mark holds null bytes and is an `unreadable-file` finding.
- The configuration is read by a strict JSON reader that follows RFC 8259 and refuses comments, trailing commas, single
  quotes and a name given twice in one object.

## Size limits

Past a limit, the input is refused with exit code `2` and no result, the file is an error finding, or, where the limit
is on the work and not the input, the report says so in a note.

| What | Limit |
| --- | --- |
| a binding file | 32 MB; a larger file is an `unreadable-file` finding |
| all the files of a run | 256 MB |
| files and folders on the command line | 100 |
| files ending in .xml in one folder | 1,000 |
| elements nested | 64 deep; deeper is an `unparsable-file` finding |
| elements in a file | 1,000,000 |
| attributes in one tag | 256 |
| a name of an element or attribute | 256 characters |
| text in one element, or one attribute value | 4,194,304 characters |
| settings written as text inside settings | read 3 levels deep; deeper is only text |
| configuration file | 1 MB; nesting 32 deep; 500 entries in `adapterTargets`, `builtInPrefixes` and `secretNames` |
| findings of one rule | 500 listed; the rest are counted in a note and still count for the result |
| problems of the input | 20 listed; the rest are counted |

The tests check twenty thousand send ports and receive locations with every check to run, external entities and the
billion laughs, values of two hundred thousand characters for every pattern that reads a secret, settings nested twelve
times, and runs of hundreds of thousands of brackets, quotes, ampersands, comments and references, each with a time
check.
