# Method

This document says exactly what the tool reads, how it reads each value, what each rule looks at and cannot see, how
the targets and the complexity scores are worked out, and how the report is built. The names used here are the
defaults; docs/inputs.md says how the configuration changes them. The tool reads binding files as they are written. It
is a starting point for a migration plan, not a migration plan and not a certification: it connects to no BizTalk group
and no Azure service, and never decides how an application should be built in Azure.

## What is read

The input is one or more binding files and folders and, if given, a configuration file. Each file is read once, in the
order named; a folder gives its files ending in `.xml`, one level deep, in the order of their names. Each file is read
as UTF-8 or, after a UTF-16 byte order mark, as UTF-16 (docs/inputs.md), and then by the XML reader of src/xml.js,
which refuses a DOCTYPE or ENTITY declaration, any entity but the five XML predefines, and XML that is not well formed
or past a limit ([decision 3](decisions/0003-read-xml-with-its-own-reader-and-no-document-type-definition.md)). The
root element must be `BindingInfo`.

From each file the tool reads the orchestrations, send ports, send port groups, receive locations and parties, with
the elements docs/inputs.md lists, by their local names. Every name, address, pipeline, map and adapter is trimmed of
white space at both ends. The transport settings (`TransportTypeData`), the pipeline settings (`...PipelineData`) and
the filters (`Filter`) hold XML written as text; each is read again with the same reader and limits.

All the files of a run make one list of artifacts, in the order of the files and, in each file, orchestrations first,
then send ports, receive locations and parties, each in the order of the file.

## How a value is read

1. **Adapters.** The name of the `TransportType` of a send port's primary and secondary transport, and of the
   `ReceiveLocationTransportType` of a receive location, compared trimmed with the letters A to Z lowered with the
   adapters of src/targets.js and `adapterTargets`.
2. **Applications.** The `ApplicationName` of a port, else the application named by the `[Application:...]` module of
   the file. Orchestrations take the application of the file; parties belong to the group and have none.
3. **Pipelines.** The `Name` of each pipeline element is the type name of the pipeline. A pipeline is custom when its
   type name starts with none of the built-in prefixes (`Microsoft.BizTalk.DefaultPipelines.`, `Microsoft.BizTalk.Edi.`,
   `Microsoft.BizTalk.Component.` and `builtInPrefixes`), compared with the letters A to Z lowered. The pipeline
   settings name a `Component` for each component whose properties were set for the port; a component whose name
   starts with none of the prefixes is a custom component. A pipeline whose name starts with `Microsoft.BizTalk.Edi.` is
   an EDI or AS2 pipeline, and its port is B2B.
4. **Maps.** The `FullName` of each `Transform` of a send port (and its inbound maps) or of a receive port (and its
   outbound maps).
5. **Filters.** Each `Group` of the filter of a send port, with its statements joined by AND; groups are joined by OR
   in the text report. A statement whose property is the name of a secret has its value masked.
6. **Enable.** A receive location whose `Enable` is `false` is disabled; any other value, or none, is enabled.
7. **Addresses.** An address is masked as soon as it is read (below), and compared in its key form: trimmed, with the
   letters A to Z lowered, back slashes read as forward slashes and trailing slashes left out.

## Credentials

A name is the name of a secret when, in its field form (the letters A to Z lowered and everything else taken out), it
holds `password`, `passwd`, `pwd`, `passphrase`, `secret`, `token` or `credentialvalue`, or ends in `key`, `keyvalue` or
`keydata`, unless it ends in `name`, `type`, `uri`, `url`, `mode`, `provider`, `enabled`, `kind`, `id`, `policy`,
`length`, `format`, `expiry`, `expiration`, `authentication` or `store`, or is `publickeytoken` or `keytoken`. A name of
`secretNames` is always the name of a secret. So `Password`, `ProxyPassword`, `SharedAccessKey`, `IssuerSecret` and
`ApiKey` are secrets, and `UserName`, `SharedAccessKeyName`, `PublicKeyToken` and `TokenType` are not.

The tool looks at every element and attribute of the file, and of the settings written as text inside it:

1. an element with no child elements whose name is that of a secret and whose text is not empty;
2. an attribute whose name is that of a secret and whose value is not empty;
3. in any other text or attribute value: the password of the user information of an address (`scheme://user:password@`)
   and the value of a name=value part, separated by `;`, `&` or `?`, whose name is that of a secret or is `sig`,
   `sharedaccesssignature` or `pass`.

Each is a `plain-text-credential` finding at the element that holds it, or at the element whose settings hold it. The
value is never kept: an address is masked when it is read, a filter value when the filter is read, and a finding names
the setting, never what it holds. The mask is `****` for every value
([decision 2](decisions/0002-mask-every-credential-and-never-print-a-secret.md)).

## Targets

Each receive location and send port gets the target of its adapter, from src/targets.js or `adapterTargets`; a backup
adapter adds its own target. A port with a custom pipeline or component adds Azure Functions for the custom code, and a
port with an EDI or AS2 pipeline adds a Logic Apps integration account. A dynamic send port gets a Logic Apps workflow
that picks the connector. An orchestration gets a Logic Apps Standard workflow, and a party a Logic Apps integration
account. A port whose adapter has no entry gets "no mapped target". The targets of an artifact are joined with `+`.

## Complexity

The complexity score of an artifact is the weight of its kind plus, for each thing that adds work, its weight times how
often it is there: each port of an orchestration, an unmapped adapter or backup adapter, each custom pipeline, each
custom component, each map, each filter statement of a send port, a two-way port, a dynamic send port, a B2B port or a
party, and a backup transport. docs/inputs.md lists the weights. A score up to 3 is low, up to 7 medium, and above 7
high. The score is a rough guide to sort the work, the tool's own choice, and no public page sets it; `--explain` shows
the parts of each score.

## Rules

Each finding has a rule, a level, the file, the line and column of the element it is about, the kind and name of its
artifact, what was found and what to change. `--explain` adds the rule, the points of the public pages it rests on, and
the tool's own choice. docs/rules-and-sources.md lists the points.

### `unmapped-adapter`

A receive location or send port whose adapter is in no entry of src/targets.js or `adapterTargets`, and a send port
whose backup adapter is in none. One finding per adapter, at the port. A dynamic send port has no adapter to map and is
reported by `dynamic-send-port`; a port that names no adapter at all is an `invalid-artifact`.

### `custom-pipeline`

A receive location or send port with a custom pipeline or a custom component in its pipeline settings. One finding per
port, naming every custom pipeline and component. The binding file names the components of a pipeline only when their
properties were set for the port, so a custom pipeline is reported whether or not its components are named, and a
custom component inside a pipeline whose settings were never changed cannot be seen.

### `orchestration`

Every orchestration, once, with its place among the orchestrations of its application and the count of its ports. Its
logic is in the assembly, which the tool does not read. Info by default.

### `orphan-send-port`

A send port, static or dynamic, with no filter statement, that no port of an orchestration in the files of the run
names (`SendPortRef`) and that is in no send port group with a filter statement. Such a port receives no message from
the binding files. It may be bound by an orchestration of another application or used through a send port group of
another file, so a warning.

### `disabled-receive-location`

A receive location whose `Enable` is `false`. Info, because it may be kept on purpose.

### `duplicate-address`

A receive location with the adapter and the key form of the address of an earlier receive location, or a send port
with those of an earlier send port, across all the files of a run. One finding per later artifact, naming the first.
An empty address is not compared. Two addresses that differ only in a masked password are the same address.

### `plain-text-credential`

A credential found as the section above says. One finding per setting, at the element that holds it.

### `dynamic-send-port`

A send port whose `IsStatic` is `false`. Its adapter and address are set at run time, by an orchestration or a
pipeline, and the binding file holds neither.

### `invalid-artifact`

A receive port, receive location, send port, orchestration or party with no name (not listed); a static send port or a
receive location that names no adapter (listed with no mapped target); and transport, pipeline or filter settings that
are not XML the reader accepts (listed, with those settings not checked). Always an error.

### `unreadable-file`

A file that is over its size limit, holds binary data, is not valid UTF-8 or UTF-16, is a symbolic link inside a folder
or cannot be opened. Nothing in it is checked. Always an error.

### `unparsable-file`

A file that the XML reader refuses, or whose root element is not `BindingInfo`. Nothing in it is checked. Always an
error.

## The report

The findings are sorted by level, errors first, then by the order of the files, the line, the column and the order of
the rules. Findings below `minSeverity` are counted in a note and not shown; at most 500 findings of one rule are
listed, and the rest are counted in a note and still count for the result. The run fails when a finding shown is at or
above `failOn`. The same files and configuration always give the same report: no clock, no random number, no locale,
and no order taken from a hash ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
