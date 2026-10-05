# Inputs

## The files

```
biztalk-binding-inventory <binding file or folder>... [--config <file>] [options]
```

One or more binding files or folders, up to 100 in all. A binding file is the XML that BizTalk Server writes when you
export the bindings of an application, an assembly or a group (in the BizTalk Server Administration console, or with
`BTSTask ExportBindings`). A file is read when its name ends in `.xml`, compared without regard to case. A folder is
read one level deep: every file directly inside it whose name ends in `.xml`, in the order of their names; other files
and subfolders are left out and counted in a note, and a symbolic link inside it is an `unreadable-file` finding. All
the files of a run are checked together, so a send port in one file that an orchestration in another file binds is not
an orphan, and a duplicate address is found across files. Each file may be named once.

```
biztalk-binding-inventory Orders.BindingInfo.xml
biztalk-binding-inventory bindings/ --format csv > inventory.csv
biztalk-binding-inventory bindings/ --config migration.json --format github
```

A file is read as UTF-8, with or without a byte order mark, or as UTF-16 little or big endian when it starts with the
byte order mark of UTF-16, which is how BizTalk Server and many Windows tools save XML. The encoding named in the XML
declaration is not used. LF, CR LF and CR line ends give the same report.

## What is read from a binding file

The root element must be `BindingInfo`. Elements are read by their local names, so a prefix does not matter. Nothing
else in the file is read, and a date in it, such as its time stamp, is never used.

| Artifact | Where | What is read |
| --- | --- | --- |
| application | `ModuleRefCollection/ModuleRef` with the name `[Application:...]` | the application of the orchestrations, and of a port with no `ApplicationName` |
| orchestration | `ModuleRefCollection/ModuleRef/Services/Service` | `Name`; `Host` `Name`; each `Ports/Port` with its `SendPortRef`, `ReceivePortRef` or `DistributionListRef` |
| send port | `SendPortCollection/SendPort` | `Name`, `IsStatic`, `IsTwoWay`; `PrimaryTransport` with `Address`, `TransportType` `Name` and `TransportTypeData`; `SecondaryTransport` the same way; `TransmitPipeline`, `ReceivePipeline` (two-way), `SendPipelineData`, `ReceivePipelineData`; `Transforms` and `InboundTransforms`; `Filter`; `ApplicationName` |
| send port group | `DistributionListCollection/DistributionList` | `Name`, `Filter` and the names of its send ports (`SendPorts/SendPort` or `SendPortRef`), only to tell whether a send port is fed |
| receive location | `ReceivePortCollection/ReceivePort/ReceiveLocations/ReceiveLocation` | `Name`, `Address`, `Enable`, `ReceiveLocationTransportType` `Name`, `ReceiveLocationTransportTypeData`, `ReceivePipeline`, `SendPipeline` (two-way), `ReceivePipelineData`, `SendPipelineData`; from its receive port: the port `Name`, `IsTwoWay`, `Transforms`, `OutboundTransforms` and `ApplicationName` |
| party | `PartyCollection/Party` | `Name`, the names of `SendPorts/SendPort`, and the count of `Aliases/PartyAlias` |

`TransportTypeData`, the pipeline settings (`...PipelineData`) and `Filter` hold XML written as text; each is read
again with the same reader, and so is XML written as text inside them, up to three levels deep. A filter is a list of
groups of statements: the statements of a group must all hold, and a message matches when one group does. Each
statement has a `Property`, an `Operator` (0 `==`, 1 `<`, 2 `<=`, 3 `>`, 4 `>=`, 5 `!=`, 6 `exists`) and a `Value`.

Every element and attribute of the file and of the settings inside it is looked at for credentials (docs/method.md).

## The adapter targets

The suggested target of each adapter, from src/targets.js. Adapters are compared trimmed with the letters A to Z
lowered, so `wcf-sql` is `WCF-SQL`; `WCFSQL` is another adapter. `adapterTargets` in the configuration adds an adapter or
replaces the target of one.

| Adapter | Suggested target |
| --- | --- |
| `FILE` | Logic Apps File System connector or Azure Blob Storage |
| `FTP` | Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP) |
| `SFTP` | Logic Apps SFTP connector |
| `HTTP`, `SOAP`, `WCF-BasicHttp`, `WCF-WSHttp`, `WCF-WebHttp`, `WCF-BasicHttpRelay` | API Management + Logic Apps or Azure Functions |
| `WCF-SQL`, `SQL` | Logic Apps SQL Server connector |
| `MQSeries`, `MQSC` | Logic Apps IBM MQ connector |
| `SB-Messaging` | Azure Service Bus |
| `SAP`, `WCF-SAP` | Logic Apps SAP connector |
| `MSMQ`, `WCF-NetMsmq` | Azure Service Bus queues |
| `SMTP` | Logic Apps SMTP or Office 365 Outlook connector |
| `POP3` | Logic Apps Office 365 Outlook connector |
| `Windows SharePoint Services` | Logic Apps SharePoint connector |
| `LogicApp` | Logic Apps Standard workflow (called directly) |

The other targets are not adapters:

| Artifact | Suggested target |
| --- | --- |
| an orchestration | Logic Apps Standard workflow |
| a party | Logic Apps integration account B2B (trading partner and agreements) |
| a port with a custom pipeline or component, in addition to its adapter's target | Azure Functions (custom pipeline code) |
| a port with an EDI or AS2 pipeline, in addition to its adapter's target | Logic Apps integration account B2B (AS2, X12, EDIFACT) |
| a dynamic send port | Logic Apps Standard workflow that picks the connector (the adapter is chosen at run time) |
| a port whose adapter is in no entry | no mapped target, with an `unmapped-adapter` finding |

`WCF-Custom`, `WCF-CustomIsolated`, `WCF-NetTcp` and `WCF-NetNamedPipe` are left out on purpose: what a `WCF-Custom` port
does depends on its binding, and a TCP or named pipe service has no one place to go. Add them to `adapterTargets` once
the team has decided.

## The configuration file

```
biztalk-binding-inventory bindings/ --config migration.json
```

Strict JSON (RFC 8259) in one object; every key is optional. A key the tool does not know is an error with its line
and a suggestion, a key named twice is refused, and a value of the wrong kind is an error. The configuration is read as
UTF-8 and is at most 1 MB. `--print-defaults` writes the built-in configuration, which read back gives the defaults.

| Key | Value | Default |
| --- | --- | --- |
| `name` | a text of 1 to 120 characters, shown in the report | none |
| `rules` | an object of rule keys to `info`, `warning`, `error` or `off` | the levels below |
| `adapterTargets` | an object of adapter names to targets, each a text of 1 to 200 characters; adds to and replaces the table above; up to 500 | none |
| `builtInPrefixes` | a list of texts; a pipeline or component whose type name starts with one of them is not custom; added to the built-in prefixes; up to 500 | none |
| `secretNames` | a list of names, compared in their field form, that are the names of secrets too; up to 500 | none |
| `weights` | an object of weight keys to whole numbers from 0 to 100 | the weights below |
| `minSeverity` | `info`, `warning` or `error`: the lowest level shown | `info` |
| `failOn` | `info`, `warning` or `error`: the lowest level that fails the run | `error` |

The flags `--min-severity` and `--fail-on` win over `minSeverity` and `failOn`.

The built-in prefixes are `Microsoft.BizTalk.DefaultPipelines.`, `Microsoft.BizTalk.Edi.` and
`Microsoft.BizTalk.Component.`, compared with the letters A to Z lowered.

### The rules

| Key | Rule | Default |
| --- | --- | --- |
| `rules.unmappedAdapter` | `unmapped-adapter` | `warning` |
| `rules.customPipeline` | `custom-pipeline` | `warning` |
| `rules.orchestration` | `orchestration` | `info` |
| `rules.orphanSendPort` | `orphan-send-port` | `warning` |
| `rules.disabledReceiveLocation` | `disabled-receive-location` | `info` |
| `rules.duplicateAddress` | `duplicate-address` | `error` |
| `rules.plainTextCredential` | `plain-text-credential` | `error` |
| `rules.dynamicSendPort` | `dynamic-send-port` | `warning` |

`invalid-artifact`, `unreadable-file` and `unparsable-file` are always errors and have no key.

### The weights

The complexity score of an artifact is the weight of its kind plus the weight of each thing that adds work, times how
often it is there. A score up to 3 is low, up to 7 medium, and above 7 high.

| Key | Added for | Default |
| --- | --- | --- |
| `weights.receiveLocation` | a receive location | 1 |
| `weights.sendPort` | a send port | 1 |
| `weights.orchestration` | an orchestration | 5 |
| `weights.party` | a party | 2 |
| `weights.orchestrationPort` | each port of an orchestration | 1 |
| `weights.unmappedAdapter` | an adapter, or backup adapter, with no mapped target | 3 |
| `weights.customPipeline` | each custom pipeline | 3 |
| `weights.customComponent` | each custom component named in the pipeline settings | 2 |
| `weights.map` | each map | 1 |
| `weights.filterStatement` | each statement of the filter of a send port | 1 |
| `weights.twoWay` | a two-way port | 1 |
| `weights.dynamicSendPort` | a dynamic send port | 2 |
| `weights.b2b` | an EDI or AS2 pipeline, or a party | 3 |
| `weights.backupTransport` | a backup transport | 1 |

An example:

```json
{
  "name": "Quillmoor migration review",
  "adapterTargets": { "WCF-NetTcp": "API Management + Azure Functions (the service moves to HTTP)" },
  "weights": { "orchestration": 6 }
}
```
