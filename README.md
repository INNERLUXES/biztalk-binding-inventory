# biztalk-binding-inventory

BizTalk to Azure migration inventory for teams that move BizTalk Server applications to Azure Integration Services.
Give it the binding files a BizTalk administrator exports for each application (the `BindingInfo` XML with its
orchestrations, send ports, receive ports and receive locations, send port groups and parties), one by one or as a
folder, and it lists every receive location, send port, orchestration and party with its adapter, its address with
every credential masked, its pipelines, maps and filters, and a suggested Azure target from a documented mapping
table. It reports what a move must plan for: an adapter with no mapped target, a custom pipeline or pipeline
component, an orchestration to redesign, a send port that nothing feeds, a disabled receive location, two ports on the
same address, a credential in plain text and a dynamic send port. It sums up each application, adapter and target,
scores each artifact, and exits with a code a pipeline can act on.

**It is an inventory to start from, not a migration plan and not a certification.** It reads what the binding files
say. It connects to no BizTalk group and no Azure service, and its targets are suggestions for the team to confirm.

A BizTalk application is mostly its bindings: which adapter each port uses, which pipeline and map it runs, what each
send port subscribes to, and which ports each orchestration is bound to. The binding file holds all of it, and so it is
the first thing to read before a move. Microsoft names Azure Logic Apps the successor of BizTalk Server and maps
adapters to connectors, orchestrations to workflows, pipelines to code and parties to integration accounts
(https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-migration-overview), and BizTalk Server takes the
passwords out of a binding file when it exports one
(https://learn.microsoft.com/en-us/biztalk/core/exporting-bindings6). This tool reads the exports on every change and
says what each artifact becomes, what needs a decision, and where a password was typed back in.

- **One row per artifact.** Every receive location, send port, orchestration and party with its application,
  adapter, masked address, pipelines, maps, filters, suggested target and complexity score, as text, JSON or CSV.
- **A documented mapping.** FILE, FTP, SFTP, HTTP and SOAP, WCF-SQL, MQSeries, SB-Messaging, SAP, MSMQ, SMTP and POP3
  each map to a Logic Apps connector or an Azure service, in a data file you can read and extend; an adapter with no
  entry is flagged, never guessed.
- **No secret in the output.** Every address is masked as it is read, and a password, key or token found in plain text
  is reported by where it is, never by what it is.
- **Safe XML.** The tool reads XML with its own reader, with no dependency, and refuses DOCTYPE and ENTITY declarations
  (XXE, the billion laughs), with limits on size and depth. UTF-8 and UTF-16 with a byte order mark are read.
- Reports as text, JSON, a CSV inventory and GitHub workflow annotations, with an exit code for a pipeline: `0` no
  finding at or above the `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network; the same files always give the same report.

```
npm test
```

```
tests 119
pass 116
fail 0
skipped 3
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link, a device or file permissions (a file, a folder, a link inside a folder and a configuration named through
a symbolic link, `/dev/zero` named as an input, and a file with no read access); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same
tests with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/biztalk-binding-inventory.git
cd biztalk-binding-inventory
node bin/biztalk-binding-inventory.js examples/messy --config examples/config.json
```

Or without a clone, on your own exports:

```
npx --yes github:INNERLUXES/biztalk-binding-inventory bindings/ --format csv > inventory.csv
```

`examples/` holds two made-up exports. `examples/messy/` is the order application of a logistics company: a FILE
receive location with a custom flat file pipeline and a custom component, a second one on the same address that was
disabled, an FTP and a WCF-BasicHttp receive location, a WCF-SQL send port with a password typed back into its
transport settings, an FTP send port with a password in its address, a custom zip pipeline, a send port that nothing
feeds, a dynamic send port, a send port on a custom adapter, a WCF-NetTcp port that `examples/config.json` maps, an AS2
port to a trading partner, an orchestration and a party. It also holds what must not be reported: the empty passwords
the export left, the built-in flat file disassembler, the ports the orchestration names or that have a filter, and the
public key tokens of the assemblies. `examples/clean/` is the invoicing application of a flour mill, in good order.

## Usage

```
biztalk-binding-inventory <binding file or folder>... [--config <file>] [options]
```

```
--config <file>           settings in strict JSON: rules, adapterTargets, builtInPrefixes, secretNames, weights,
                          minSeverity and failOn (--print-defaults shows them)
--format <name>           text, json, csv or github (default: text); csv writes one row per artifact, github writes
                          workflow commands that GitHub shows as annotations
--json                    the same as --format json
--min-severity <level>    the lowest level of a finding that is shown: info, warning, error (default: minSeverity of
                          the configuration, else info)
--fail-on <level>         the lowest level of a finding that fails the run: info, warning, error (default: failOn of
                          the configuration, else error)
--explain                 show the rule, the public sources and the tool's own choice behind each finding, and the
                          parts of each complexity score
--print-defaults          print the built-in configuration and exit
--help                    show the usage
--version                 show the version
```

The files are read in the order named and checked as one set; a folder gives its files ending in `.xml`, one level
deep, in the order of their names. The path in the report is relative to the folder you run the command in, with
forward slashes on every system, followed by the line.

The report of the messy example starts with what was read, the configuration, the rules, the artifacts in one line and
the count of findings; then a table per application, per adapter and per target; then every artifact; then the
findings, errors first, each with what to change:

```
biztalk-binding-inventory: examples/messy/Quillmoor.Orders.BindingInfo.xml
input: 1 binding file from 1 folder (examples/messy): 1 read (1 UTF-8), 0 not read
config: examples/config.json (Quillmoor migration review): 23 adapters with a target (1 from the configuration); minimum severity info; fail on error
rules: unmapped-adapter (warning); custom-pipeline (warning); orchestration (info); orphan-send-port (warning); disabled-receive-location (info); duplicate-address (error); plain-text-credential (error); dynamic-send-port (warning); invalid-artifact (error); unreadable-file (error); unparsable-file (error)
artifacts: 14 in 1 application: 4 receive locations, 8 send ports, 1 orchestration, 1 party; complexity 56 (7 low, 6 medium, 1 high)
findings: 10 (3 error, 5 warning, 2 info)

Applications (1)

  application       receive locations  send ports  orchestrations  complexity
  Quillmoor.Orders  4                  8           1               51

Adapters (8)

  adapter          artifacts  suggested target
  FILE             4          Logic Apps File System connector or Azure Blob Storage
  FTP              2          Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP)
  (dynamic)        1          Logic Apps Standard workflow that picks the connector (the adapter is chosen at run time)
  HTTP             1          API Management + Logic Apps or Azure Functions
  Quillmoor.Telex  1          no mapped target
  WCF-BasicHttp    1          API Management + Logic Apps or Azure Functions
  WCF-NetTcp       1          API Management + Azure Functions (the service moves to HTTP)
  WCF-SQL          1          Logic Apps SQL Server connector

Targets (11)

  suggested target                                                                           artifacts
  Logic Apps File System connector or Azure Blob Storage                                     4
  API Management + Logic Apps or Azure Functions                                             2
  Azure Functions (custom pipeline code)                                                     2
  Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP)            2
  API Management + Azure Functions (the service moves to HTTP)                               1
  Logic Apps SQL Server connector                                                            1
  Logic Apps Standard workflow                                                               1
  Logic Apps Standard workflow that picks the connector (the adapter is chosen at run time)  1
  Logic Apps integration account B2B (AS2, X12, EDIFACT)                                     1
  Logic Apps integration account B2B (trading partner and agreements)                        1
  no mapped target                                                                           1

Artifacts (14)

  orchestration  Quillmoor.Orders.Processes.ApproveOrder (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:10
           host: QuillmoorProcessing
           ports: ReceiveOrder -> receive port RP_OrderIn; WriteToWarehouse -> send port SP_WarehouseSql; SendStatus -> send port SP_DynamicStatus
           target: Logic Apps Standard workflow
           complexity: 9 (high)
           findings: info orchestration

  send-port  SP_WarehouseSql (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:30
           adapter: WCF-SQL
           address: mssql://wh-db01.quillmoor.test//Warehouse?
           pipelines: send Microsoft.BizTalk.DefaultPipelines.XMLTransmit
           maps: Quillmoor.Orders.Maps.OrderToWarehouse
           filter: none
           target: Logic Apps SQL Server connector
           complexity: 2 (low)
           findings: error plain-text-credential

  send-port  SP_ArchiveFile (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:54
           adapter: FILE
           address: C:\Quillmoor\Archive\%MessageID%.zip
           pipelines: send Quillmoor.Orders.Pipelines.ZipTransmit (custom)
           filter: BTS.ReceivePortName == RP_OrderIn
           target: Logic Apps File System connector or Azure Blob Storage + Azure Functions (custom pipeline code)
           complexity: 5 (medium)
           findings: warning custom-pipeline

  send-port  SP_PartnerFtp (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:69
           adapter: FTP
           address: ftp://qm_orders:****@ftp.ridgeback.test/inbound/
           pipelines: send Microsoft.BizTalk.DefaultPipelines.PassThruTransmit
           maps: Quillmoor.Orders.Maps.ShipNoticeToRidgeback
           filter: BTS.MessageType == urn:quillmoor:orders#ShipNotice AND Quillmoor.Orders.Partner == RIDGEBACK
           target: Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP)
           complexity: 4 (medium)
           findings: error plain-text-credential

  send-port  SP_LegacyAudit (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:86
           adapter: FILE
           address: \\qm-audit01\audit\orders\%MessageID%.xml
           pipelines: send Microsoft.BizTalk.DefaultPipelines.PassThruTransmit
           filter: none
           target: Logic Apps File System connector or Azure Blob Storage
           complexity: 1 (low)
           findings: warning orphan-send-port

  send-port  SP_DynamicStatus (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:100
           adapter: dynamic (set at run time)
           pipelines: send Microsoft.BizTalk.DefaultPipelines.XMLTransmit
           filter: none
           target: Logic Apps Standard workflow that picks the connector (the adapter is chosen at run time)
           complexity: 3 (low)
           findings: warning dynamic-send-port

  send-port  SP_Telex (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:107
           adapter: Quillmoor.Telex
           address: telex://qm-telex01/line4
           pipelines: send Microsoft.BizTalk.DefaultPipelines.PassThruTransmit
           filter: BTS.MessageType == urn:quillmoor:orders#Recall
           target: no mapped target
           complexity: 5 (medium)
           findings: warning unmapped-adapter

  send-port  SP_StockService (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:121
           adapter: WCF-NetTcp
           address: net.tcp://stock.quillmoor.test:8808/StockService
           two-way: yes
           pipelines: send Microsoft.BizTalk.DefaultPipelines.XMLTransmit; receive Microsoft.BizTalk.DefaultPipelines.XMLReceive
           filter: BTS.MessageType == urn:quillmoor:orders#StockQuery
           target: API Management + Azure Functions (the service moves to HTTP)
           complexity: 3 (low)
           findings: none

  send-port  SP_RidgebackAs2 (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:137
           adapter: HTTP
           address: https://as2.ridgeback.test/receive
           pipelines: send Microsoft.BizTalk.Edi.DefaultPipelines.AS2EdiSend
           filter: EDI.DestinationPartyName == Ridgeback Supplies
           target: API Management + Logic Apps or Azure Functions + Logic Apps integration account B2B (AS2, X12, EDIFACT)
           complexity: 5 (medium)
           findings: none

  receive-location  RL_Orders_File (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:157
           adapter: FILE
           address: C:\Quillmoor\Drop\Orders\*.csv
           receive port: RP_OrderIn
           enabled: yes
           pipelines: receive Quillmoor.Orders.Pipelines.FlatFileReceive (custom; custom component Quillmoor.Components.HeaderStripper)
           maps: Quillmoor.Orders.Maps.FlatOrderToOrder
           target: Logic Apps File System connector or Azure Blob Storage + Azure Functions (custom pipeline code)
           complexity: 7 (medium)
           findings: warning custom-pipeline

  receive-location  RL_Orders_File_Old (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:170
           adapter: FILE
           address: C:\Quillmoor\Drop\Orders\*.csv
           receive port: RP_OrderIn
           enabled: no
           pipelines: receive Microsoft.BizTalk.DefaultPipelines.PassThruReceive
           maps: Quillmoor.Orders.Maps.FlatOrderToOrder
           target: Logic Apps File System connector or Azure Blob Storage
           complexity: 2 (low)
           findings: error duplicate-address, info disabled-receive-location

  receive-location  RL_Orders_Ftp (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:181
           adapter: FTP
           address: ftp://ftp.ridgeback.test/outbound/*.xml
           receive port: RP_OrderIn
           enabled: yes
           pipelines: receive Microsoft.BizTalk.DefaultPipelines.XMLReceive
           maps: Quillmoor.Orders.Maps.FlatOrderToOrder
           target: Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP)
           complexity: 2 (low)
           findings: none

  receive-location  RL_OrderApi_Soap (Quillmoor.Orders)  examples/messy/Quillmoor.Orders.BindingInfo.xml:202
           adapter: WCF-BasicHttp
           address: /Quillmoor.Orders/OrderService.svc
           receive port: RP_OrderApi
           enabled: yes
           two-way: yes
           pipelines: receive Microsoft.BizTalk.DefaultPipelines.XMLReceive; send Microsoft.BizTalk.DefaultPipelines.PassThruTransmit
           maps: Quillmoor.Orders.Maps.ApiOrderToOrder
           target: API Management + Logic Apps or Azure Functions
           complexity: 3 (low)
           findings: none

  party  Ridgeback Supplies  examples/messy/Quillmoor.Orders.BindingInfo.xml:222
           send ports: SP_RidgebackAs2
           target: Logic Apps integration account B2B (trading partner and agreements)
           complexity: 5 (medium)
           findings: none

Findings (10)

  ERROR    plain-text-credential      examples/messy/Quillmoor.Orders.BindingInfo.xml:36
           the send port "SP_WarehouseSql" holds a value for Password in plain text, in its TransportTypeData; the value is shown here as ****
           fix: take the value out of the binding file, rotate it, and keep it in Azure Key Vault or behind a managed identity in the target

  ERROR    plain-text-credential      examples/messy/Quillmoor.Orders.BindingInfo.xml:73
           the send port "SP_PartnerFtp" holds the password in the user information of an address in plain text, in its Address; the value is shown here as ****
           fix: take the value out of the binding file, rotate it, and keep it in Azure Key Vault or behind a managed identity in the target

  ERROR    duplicate-address          examples/messy/Quillmoor.Orders.BindingInfo.xml:170
           the receive location "RL_Orders_File_Old" uses the same FILE address (C:\Quillmoor\Drop\Orders\*.csv) as the receive location "RL_Orders_File" at examples/messy/Quillmoor.Orders.BindingInfo.xml:157
           fix: give each receive location and send port its own address, or keep one of them

  WARNING  custom-pipeline            examples/messy/Quillmoor.Orders.BindingInfo.xml:54
           the send port "SP_ArchiveFile" uses the custom send pipeline Quillmoor.Orders.Pipelines.ZipTransmit, which is code to rewrite
           fix: rewrite the custom pipeline code as an Azure Function, a .NET local function or a workflow action, or replace it with a built-in operation such as Flat File or XML

  WARNING  orphan-send-port           examples/messy/Quillmoor.Orders.BindingInfo.xml:86
           the send port "SP_LegacyAudit" has no filter, no orchestration port names it and it is in no send port group with a filter, so it receives no message
           fix: remove the send port if it is not used, or name the subscription it serves so the move can route it, such as a Service Bus subscription

  WARNING  dynamic-send-port          examples/messy/Quillmoor.Orders.BindingInfo.xml:100
           the send port "SP_DynamicStatus" is dynamic: its adapter and address are set at run time, and the binding file names neither
           fix: list the adapters and addresses the port is given at run time, from the orchestration or pipeline that sets them, and map each one

  WARNING  unmapped-adapter           examples/messy/Quillmoor.Orders.BindingInfo.xml:107
           the send port "SP_Telex" uses the adapter "Quillmoor.Telex", which has no mapped Azure target
           fix: choose the Azure connector or service for the adapter and add it to adapterTargets in the configuration, or plan a custom connector

  WARNING  custom-pipeline            examples/messy/Quillmoor.Orders.BindingInfo.xml:157
           the receive location "RL_Orders_File" uses the custom receive pipeline Quillmoor.Orders.Pipelines.FlatFileReceive and the custom component Quillmoor.Components.HeaderStripper in the settings of the receive pipeline, which is code to rewrite
           fix: rewrite the custom pipeline code as an Azure Function, a .NET local function or a workflow action, or replace it with a built-in operation such as Flat File or XML

  INFO     orchestration              examples/messy/Quillmoor.Orders.BindingInfo.xml:10
           the orchestration "Quillmoor.Orders.Processes.ApproveOrder" (1 of 1 in Quillmoor.Orders) is bound to 3 ports; its logic is in the assembly, not in the binding file
           fix: redesign the orchestration as a Logic Apps Standard workflow, and move its ports to triggers and actions

  INFO     disabled-receive-location  examples/messy/Quillmoor.Orders.BindingInfo.xml:170
           the receive location "RL_Orders_File_Old" is disabled
           fix: decide whether the receive location is still needed; leave it out of the move if it is not

note: examples/messy: 1 file whose name does not end in .xml was not read: "README.md"

This inventory reads the binding files as they are written. It connects to no BizTalk group and no Azure service, and its targets are suggestions to review, not a migration plan and not a certification (docs/limits.md).

RESULT: FAIL - 3 findings at or above error (3 error, 5 warning, 2 info)
```

With `--explain`, each finding also shows the rule, the points of the public pages it rests on and the tool's own
choice, and each artifact the parts of its complexity score:

```
  ERROR    plain-text-credential      examples/messy/Quillmoor.Orders.BindingInfo.xml:36
           the send port "SP_WarehouseSql" holds a value for Password in plain text, in its TransportTypeData; the value is shown here as ****
           fix: take the value out of the binding file, rotate it, and keep it in Azure Key Vault or behind a managed identity in the target
           rule: a value in a setting named like a password, secret, key or token, a password in an address, or a secret in a connection string
           basis: BizTalk Server takes the passwords out of a binding file when it exports one, so they must be set again after an import, and the file may still hold sensitive data that must be kept safe (Exporting Bindings (Microsoft Learn, BizTalk Server), https://learn.microsoft.com/en-us/biztalk/core/exporting-bindings6)
           the tool's own choice: an element or attribute whose name is that of a secret (docs/method.md) with a value, in the binding file or in the transport, pipeline or filter settings inside it, and the password of an address or the secret part of a connection string; the value is never shown, and the tool cannot tell whether it is still valid

```

The clean example passes:

```
biztalk-binding-inventory: examples/clean/Tamberly.Invoicing.BindingInfo.xml
input: 1 binding file: 1 read (1 UTF-8), 0 not read
config: built-in defaults: 22 adapters with a target; minimum severity info; fail on error
rules: unmapped-adapter (warning); custom-pipeline (warning); orchestration (info); orphan-send-port (warning); disabled-receive-location (info); duplicate-address (error); plain-text-credential (error); dynamic-send-port (warning); invalid-artifact (error); unreadable-file (error); unparsable-file (error)
artifacts: 3 in 1 application: 1 receive location, 2 send ports, 0 orchestrations, 0 parties; complexity 7 (3 low, 0 medium, 0 high)
findings: 0

Applications (1)

  application         receive locations  send ports  orchestrations  complexity
  Tamberly.Invoicing  1                  2           0               7

Adapters (3)

  adapter       artifacts  suggested target
  FILE          1          Logic Apps File System connector or Azure Blob Storage
  SB-Messaging  1          Azure Service Bus
  SFTP          1          Logic Apps SFTP connector

Targets (3)

  suggested target                                        artifacts
  Azure Service Bus                                       1
  Logic Apps File System connector or Azure Blob Storage  1
  Logic Apps SFTP connector                               1

Artifacts (3)

  send-port  SP_Invoices_Sftp (Tamberly.Invoicing)  examples/clean/Tamberly.Invoicing.BindingInfo.xml:10
           adapter: SFTP
           address: sftp://files.tamberly.test:22/invoices/%MessageID%.xml
           pipelines: send Microsoft.BizTalk.DefaultPipelines.XMLTransmit
           maps: Tamberly.Invoicing.Maps.InvoiceToPartner
           filter: BTS.ReceivePortName == RP_Invoices
           target: Logic Apps SFTP connector
           complexity: 3 (low)
           findings: none

  send-port  SP_Invoices_Bus (Tamberly.Invoicing)  examples/clean/Tamberly.Invoicing.BindingInfo.xml:27
           adapter: SB-Messaging
           address: sb://tamberly-bus.servicebus.test/invoices
           pipelines: send Microsoft.BizTalk.DefaultPipelines.PassThruTransmit
           filter: BTS.ReceivePortName == RP_Invoices AND Tamberly.Invoicing.Region == NORTH
           target: Azure Service Bus
           complexity: 3 (low)
           findings: none

  receive-location  RL_Invoices_File (Tamberly.Invoicing)  examples/clean/Tamberly.Invoicing.BindingInfo.xml:48
           adapter: FILE
           address: D:\Tamberly\Invoices\In\*.xml
           receive port: RP_Invoices
           enabled: yes
           pipelines: receive Microsoft.BizTalk.DefaultPipelines.XMLReceive
           target: Logic Apps File System connector or Azure Blob Storage
           complexity: 1 (low)
           findings: none

Findings (0)

  none

This inventory reads the binding files as they are written. It connects to no BizTalk group and no Azure service, and its targets are suggestions to review, not a migration plan and not a certification (docs/limits.md).

RESULT: PASS - no finding at or above error
```

## How a binding file is read

1. The file is read as UTF-8 or UTF-16 and then by the tool's own XML reader, which refuses a DOCTYPE or ENTITY
   declaration and any entity but the five XML predefines; the root element must be `BindingInfo`.
2. Each orchestration, send port, receive location and party is read with its adapter, address, pipelines, maps and
   filters. The transport, pipeline and filter settings, which hold XML written as text, are read again the same way.
3. Every address is masked as it is read, and every element and attribute is looked at for a password, key or token in
   plain text.
4. Each artifact gets its suggested target from src/targets.js and `adapterTargets`, and its complexity score from the
   weights.
5. The artifacts of all the files are compared: a send port that no filter, orchestration or send port group feeds is
   an orphan, and two receive locations or two send ports on the same adapter and address are duplicates.

[docs/method.md](docs/method.md) gives the details, and
[decision 3](docs/decisions/0003-read-xml-with-its-own-reader-and-no-document-type-definition.md) says why the tool
reads XML itself.

## What it reports

| Rule | Key | Default level | Finds |
| --- | --- | --- | --- |
| `unmapped-adapter` | `rules.unmappedAdapter` | warning | a receive location or send port whose adapter, or backup adapter, has no mapped target |
| `custom-pipeline` | `rules.customPipeline` | warning | a custom pipeline, or a custom component in the pipeline settings, which is code to rewrite |
| `orchestration` | `rules.orchestration` | info | every orchestration, with the count of its application, to redesign as a workflow |
| `orphan-send-port` | `rules.orphanSendPort` | warning | a send port with no filter that no orchestration or send port group feeds |
| `disabled-receive-location` | `rules.disabledReceiveLocation` | info | a receive location that is disabled |
| `duplicate-address` | `rules.duplicateAddress` | error | two receive locations, or two send ports, on the same adapter and address |
| `plain-text-credential` | `rules.plainTextCredential` | error | a password, key or token in plain text, shown masked |
| `dynamic-send-port` | `rules.dynamicSendPort` | warning | a send port whose adapter and address are set at run time |
| `invalid-artifact` | none | error | an artifact with no name or no adapter, or settings inside it that cannot be read |
| `unreadable-file` | none | error | a file that cannot be read as UTF-8 or UTF-16 text |
| `unparsable-file` | none | error | a file the XML reader refuses, such as one with a DOCTYPE, or that is not a binding file |

The three rules of input problems are always errors. [docs/method.md](docs/method.md) says exactly what each rule looks
at and what it cannot see, and [docs/rules-and-sources.md](docs/rules-and-sources.md) gives the points of the public
pages each rule and each target rests on.

## The targets

The suggested Azure target of each adapter, from `src/targets.js`; `adapterTargets` in the configuration adds or
replaces an entry.

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

An orchestration becomes a Logic Apps Standard workflow, a party a trading partner in a Logic Apps integration account,
custom pipeline code an Azure Function, and an EDI or AS2 pipeline adds the integration account B2B operations. A
dynamic send port gets a workflow that picks the connector, and an adapter with no entry, such as a custom adapter or
`WCF-Custom`, is flagged. Confirm each connector, its authentication, its throughput and its hosting before you rely on
a target.

## What is not checked

The tool reads what the files say and never guesses. It does not:

- connect to a BizTalk group, its databases or Azure, or deploy anything;
- read the assemblies: the logic of the orchestrations, the code of the pipeline components, the maps and the schemas;
- decide whether a target fits an application, how many workflows an orchestration should become, or what a dynamic
  send port is given at run time;
- find a secret stored under a name the list does not hold, or tell whether a secret is still valid;
- read an MSI package or a project file, or validate a binding file against a schema;
- plan the migration: it is not a migration plan and not a certification.

So a clean run means the files hold none of the problems the rules look for, and every report says so.

## The binding files

Export the bindings of an application in the BizTalk Server Administration console (right-click the application,
Export, Bindings) or with `BTSTask ExportBindings`, and keep the files together:

```
bindings/
  Orders.BindingInfo.xml
  Invoicing.BindingInfo.xml
```

```
biztalk-binding-inventory bindings/ --config bindings/migration.json
```

The tool reads the orchestrations of `ModuleRefCollection`, the send ports of `SendPortCollection`, the send port groups
of `DistributionListCollection`, the receive locations of `ReceivePortCollection` and the parties of `PartyCollection`,
by the local names of their elements. Take any password out of a file before it is committed; the tool masks it in
every report, but the file still holds it. [docs/inputs.md](docs/inputs.md) lists every element read.

## The configuration file

```json
{
  "name": "Quillmoor migration review",
  "adapterTargets": { "WCF-NetTcp": "API Management + Azure Functions (the service moves to HTTP)" },
  "weights": { "orchestration": 6 }
}
```

Every key is optional, and without `--config` the defaults apply. `rules` sets the level of each rule (`info`,
`warning`, `error` or `off`), `adapterTargets` adds or replaces adapter targets, `builtInPrefixes` adds type names of
pipelines and components that are not custom, `secretNames` adds names of secrets, `weights` sets the weights of the
complexity score, `minSeverity` sets the lowest level shown and `failOn` the lowest level that fails the run. A key the
tool does not know is an error with its line and a suggestion, and a key named twice is refused.
[docs/inputs.md](docs/inputs.md) describes every key, and `--print-defaults` writes the whole default configuration out.

## Formats

- `text`: for a terminal: what was read, the configuration, the rules, the artifacts in one line, a table per
  application, adapter and target, every artifact with its fields, the findings with the file and line and what to
  change, the notes, the notice and the result. With `--explain` also the rule, the points of the public pages and the
  tool's own choice behind each finding, and the parts of each score.
- `json` (or `--json`): the whole report: the input, the configuration, the summary, every artifact with its fields and
  targets, every finding with its file, line, column and artifact, the totals, the result, the notes and the notice.
- `csv`: the inventory, one record per artifact, ready for a sheet: the kind, the name, the application, the adapter,
  the masked address, the suggested target, the complexity and the findings, with CRLF line ends as RFC 4180 writes,
  and one record of the kind `file` for findings of a file that belong to no artifact. A field that a spreadsheet could
  read as a formula gets a single quote in front. The start of the messy example:

```
kind,name,application,adapter,address,target,complexity,findings
orchestration,Quillmoor.Orders.Processes.ApproveOrder,Quillmoor.Orders,,,Logic Apps Standard workflow,9,info orchestration
send-port,SP_WarehouseSql,Quillmoor.Orders,WCF-SQL,mssql://wh-db01.quillmoor.test//Warehouse?,Logic Apps SQL Server connector,2,error plain-text-credential
send-port,SP_ArchiveFile,Quillmoor.Orders,FILE,C:\Quillmoor\Archive\%MessageID%.zip,Logic Apps File System connector or Azure Blob Storage + Azure Functions (custom pipeline code),5,warning custom-pipeline
send-port,SP_PartnerFtp,Quillmoor.Orders,FTP,ftp://qm_orders:****@ftp.ridgeback.test/inbound/,Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP),4,error plain-text-credential
```

- `github`: one workflow command per finding, `::error`, `::warning` or `::notice` (for info) with the file, line and
  column, which GitHub shows as an annotation in the pull request, then a summary line. The characters a command gives
  a meaning to are escaped. Two findings of the messy example:

```
::error file=examples/messy/Quillmoor.Orders.BindingInfo.xml,line=170,col=9,title=biztalk-binding-inventory duplicate-address::the receive location "RL_Orders_File_Old" uses the same FILE address (C:\Quillmoor\Drop\Orders\*.csv) as the receive location "RL_Orders_File" at examples/messy/Quillmoor.Orders.BindingInfo.xml:157; fix: give each receive location and send port its own address, or keep one of them
::warning file=examples/messy/Quillmoor.Orders.BindingInfo.xml,line=100,col=5,title=biztalk-binding-inventory dynamic-send-port::the send port "SP_DynamicStatus" is dynamic: its adapter and address are set at run time, and the binding file names neither; fix: list the adapters and addresses the port is given at run time, from the orchestration or pipeline that sets them, and map each one
```

## Exit codes

`0`: no finding at or above the fail-on level (`error` by default). `1`: at least one finding at or above it; with the
default, a duplicate address, a credential in plain text, or a file or artifact the tool could not read; with
`--fail-on warning`, unmapped adapters, custom pipelines, orphan send ports and dynamic send ports too. `2`: a usage or
input error: no binding file named, an unknown option, an option given twice, `--explain` with the csv or github
format, a URL in place of a path, a path that cannot be read, a symbolic link named on the command line, a file whose
name does not end in `.xml`, input past the limit of a run, or a configuration with an unknown key, a key named twice
or a value of the wrong kind. With exit code `2` the tool gives no result and prints the problems on standard error.

## Limits

The tool reads files; it does not connect to BizTalk or Azure, or track time. A run reports what the files hold in the
forms of docs/method.md. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 32 MB for a
file, 256 MB for a run, elements nested 64 deep, 500 findings listed per rule.
[docs/threat-model.md](docs/threat-model.md) lists the risks of reading binding files from a pull request and their
controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the configuration and the binding files, and builds the report of the run |
| `src/files.js`, `src/kinds.js` | the bounded reading of files and folders with no link followed, UTF-8 and UTF-16, and the kind of each file |
| `src/xml.js` | the XML reader, with no document type definition and its limits |
| `src/bindings.js` | the artifacts of one binding file, their settings, and the credentials and artifacts that cannot be read |
| `src/secrets.js` | the names of secrets and the masking of addresses and connection strings |
| `src/targets.js` | the suggested targets of the adapters and the kinds of artifacts, as a documented data file |
| `src/inventory.js` | the targets, the rules across artifacts, the complexity scores and the summary |
| `src/config.js`, `src/defaults.js`, `src/json.js` | the configuration file over the defaults, and its strict JSON reader |
| `src/rules.js` | the rules, their levels and the result |
| `src/report.js`, `src/csv.js`, `src/text.js`, `src/size.js`, `src/words.js` | the text, JSON, CSV and GitHub output, the cleaning of text from the input, number formats and compared words |
| `src/data.js` | the public pages and the points the rules and targets rest on, in this project's own words |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| What a binding file holds | Microsoft Learn, https://learn.microsoft.com/en-us/biztalk/core/binding-files-and-application-deployment |
| Passwords are taken out on export, and a binding file may hold sensitive data | Microsoft Learn, https://learn.microsoft.com/en-us/biztalk/core/exporting-bindings6 |
| The adapters of BizTalk Server | Microsoft Learn, https://learn.microsoft.com/en-us/biztalk/core/adapters-in-biztalk-server |
| Logic Apps as the successor, the lifecycle of BizTalk Server, and the path of each capability | Microsoft Learn, https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-migration-overview |
| Mainstream and extended support | Microsoft Learn, https://learn.microsoft.com/en-us/lifecycle/policies/fixed |
| The Azure services for integration | Azure Architecture Center, https://learn.microsoft.com/en-us/azure/architecture/integration/integration-get-started |
| The built-in connectors of Logic Apps | Microsoft Learn, https://learn.microsoft.com/en-us/azure/connectors/built-in |
| The managed connectors of Logic Apps | Microsoft Learn, https://learn.microsoft.com/en-us/azure/connectors/managed |
| XML external entities and entity expansion | OWASP, https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html |
| The CSV format | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180 |
| Repeated names in a JSON object, and UTF-8 | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |
| Formulas hidden in CSV files | OWASP, https://community.owasp.org/attacks/CSV_Injection |
| Annotations from workflow commands | GitHub Docs, https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands |

[research/sources.md](research/sources.md) has a note on each page, in this project's own words.

## Background

BizTalk Server has reached its last release, and Microsoft points its users to Logic Apps and the other Azure
integration services. A move starts with knowing what there is: every port, adapter, pipeline, map, filter and
orchestration of every application, and the passwords that should never have been in the exports. An inventory that is
checked on every change keeps that list honest while the move is planned. How such moves are planned and built is
described on the page [Azure Integration Services](https://innerluxes.dev/application/integration/azure).

## License

MIT
