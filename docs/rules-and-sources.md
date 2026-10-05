# Rules and sources

Every rule and every target rests on points of public pages, written in this project's own words; this document
lists them, with the choices that are the tool's own and what to change. The same points are in src/data.js and are
shown by `--explain`; research/sources.md has a longer note on each page. The tool reads binding files: a point says
what a page says, and a finding says what a file holds. The inventory is not a migration plan and not a certification.

## The targets

| Adapter | Suggested target | Points |
| --- | --- | --- |
| `FILE` | Logic Apps File System connector or Azure Blob Storage | `builtInConnectors`, `adaptersToConnectors` |
| `FTP` | Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP) | `builtInConnectors`, `adaptersToConnectors` |
| `SFTP` | Logic Apps SFTP connector | `builtInConnectors`, `managedConnectors` |
| `HTTP` | API Management + Logic Apps or Azure Functions | `aisServices`, `adaptersToConnectors` |
| `SOAP` | API Management + Logic Apps or Azure Functions | `aisServices`, `adaptersToConnectors` |
| `WCF-BasicHttp` | API Management + Logic Apps or Azure Functions | `aisServices`, `adaptersToConnectors` |
| `WCF-WSHttp` | API Management + Logic Apps or Azure Functions | `aisServices`, `adaptersToConnectors` |
| `WCF-WebHttp` | API Management + Logic Apps or Azure Functions | `aisServices`, `adaptersToConnectors` |
| `WCF-BasicHttpRelay` | API Management + Logic Apps or Azure Functions | `aisServices`, `adaptersToConnectors` |
| `WCF-SQL` | Logic Apps SQL Server connector | `builtInConnectors`, `managedConnectors` |
| `SQL` | Logic Apps SQL Server connector | `builtInConnectors`, `managedConnectors` |
| `MQSeries` | Logic Apps IBM MQ connector | `builtInConnectors`, `managedConnectors` |
| `MQSC` | Logic Apps IBM MQ connector | `builtInConnectors`, `managedConnectors` |
| `SB-Messaging` | Azure Service Bus | `aisServices`, `builtInConnectors` |
| `SAP` | Logic Apps SAP connector | `builtInConnectors`, `managedConnectors` |
| `WCF-SAP` | Logic Apps SAP connector | `builtInConnectors`, `managedConnectors` |
| `MSMQ` | Azure Service Bus queues | `aisServices`, `messageBoxToBroker` |
| `WCF-NetMsmq` | Azure Service Bus queues | `aisServices`, `messageBoxToBroker` |
| `SMTP` | Logic Apps SMTP or Office 365 Outlook connector | `builtInConnectors`, `managedConnectors` |
| `POP3` | Logic Apps Office 365 Outlook connector | `managedConnectors` |
| `Windows SharePoint Services` | Logic Apps SharePoint connector | `managedConnectors` |
| `LogicApp` | Logic Apps Standard workflow (called directly) | `logicAppsSuccessor` |

| Artifact | Suggested target | Points |
| --- | --- | --- |
| an orchestration | Logic Apps Standard workflow | `orchestrationsToWorkflows`, `logicAppsSuccessor` |
| a party | Logic Apps integration account B2B (trading partner and agreements) | `b2bToIntegrationAccount` |
| custom pipeline code | Azure Functions (custom pipeline code) | `pipelinesToCode` |
| an EDI or AS2 pipeline | Logic Apps integration account B2B (AS2, X12, EDIFACT) | `b2bToIntegrationAccount` |
| a dynamic send port | Logic Apps Standard workflow that picks the connector (the adapter is chosen at run time) | `adaptersToConnectors` |

The table of adapters is the tool's own reading of the pages: the migration overview says adapters move to built-in,
managed or custom connectors and APIs, and the connector pages list the connectors; no page maps each adapter to one
connector. Confirm the connector, its authentication, its throughput and its hosting before you rely on a target, as
the migration overview says. `adapterTargets` in the configuration adds or replaces an entry.

## The rules

| Rule | Default level | Points |
| --- | --- | --- |
| `unmapped-adapter` | warning | `nativeAdapters`, `adaptersToConnectors`, `builtInConnectors`, `managedConnectors` |
| `custom-pipeline` | warning | `pipelinesToCode` |
| `orchestration` | info | `orchestrationsToWorkflows`, `logicAppsSuccessor` |
| `orphan-send-port` | warning | `bindingEndpoints`, `messageBoxToBroker` |
| `disabled-receive-location` | info | `adapterRole` |
| `duplicate-address` | error | `adapterRole` |
| `plain-text-credential` | error | `exportNoPasswords` |
| `dynamic-send-port` | warning | `adaptersToConnectors`, `bindingEndpoints` |
| `invalid-artifact` | error, always | `bindingContents` |
| `unreadable-file` | error, always | `bindingContents`, `xxeDenialOfService` |
| `unparsable-file` | error, always | `xxeRejectDoctype`, `xxeDenialOfService`, `exportScope` |

### `unmapped-adapter`

An adapter has no mapped Azure target.

- `nativeAdapters` (Adapters in BizTalk Server (Microsoft Learn)): the native adapters are FILE, FTP, HTTP, MQSeries, MSMQ, POP3, SMTP, SOAP, Windows SharePoint Services and seven WCF adapters, and custom adapters are built with the BizTalk Adapter Framework.
- `adaptersToConnectors` (Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)): adapters are replaced by built-in, managed or custom connectors and APIs, once the connector, its authentication, its throughput and its hosting are confirmed.
- `builtInConnectors` (Built-In Connectors Overview, Azure Logic Apps (Microsoft Learn)): a Standard workflow has built-in connectors that run in the Logic Apps runtime, among them File System, FTP, SFTP, SMTP, SQL Server, IBM MQ, SAP, Service Bus, Blob Storage and Azure Functions.
- `managedConnectors` (Managed Connectors Overview, Azure Logic Apps (Microsoft Learn)): managed connectors are run by Microsoft in Azure, such as Office 365 Outlook, SharePoint and SFTP-SSH, with enterprise connectors for SAP and IBM MQ and a data gateway for systems on the premises.

The tool's own choice: the targets are the table of src/targets.js and the adapterTargets of the configuration; an adapter in neither, such as a custom adapter or WCF-Custom, whose binding decides what it does, is reported; the receive location or send port is still listed.

What to change: choose the Azure connector or service for the adapter and add it to adapterTargets in the configuration, or plan a custom connector.

### `custom-pipeline`

A port uses a custom pipeline or pipeline component.

- `pipelinesToCode` (Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)): pipelines and helper code move to workflow actions, .NET local functions, inline code, custom connectors or external services such as Azure Functions.

The tool's own choice: a pipeline or a component named in the per-instance pipeline settings whose type name starts with none of the built-in prefixes of src/targets.js and builtInPrefixes is custom code; the binding file names the components only when the pipeline settings were changed for the port, so a custom pipeline is reported even when its components are not listed.

What to change: rewrite the custom pipeline code as an Azure Function, a .NET local function or a workflow action, or replace it with a built-in operation such as Flat File or XML.

### `orchestration`

An orchestration needs a redesign.

- `orchestrationsToWorkflows` (Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)): orchestrations are refactored into stateful or stateless Logic Apps Standard workflows.
- `logicAppsSuccessor` (Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)): Azure Logic Apps is named the successor of BizTalk Server, and Logic Apps Standard is the target for most BizTalk modernization work.

The tool's own choice: every orchestration is reported once, with the count of orchestrations of its application, because its logic is in the assembly and not in the binding file; info by default, because it is work to plan, not a fault.

What to change: redesign the orchestration as a Logic Apps Standard workflow, and move its ports to triggers and actions.

### `orphan-send-port`

A send port has no filter and no orchestration bound to it.

- `bindingEndpoints` (Binding Files and Application Deployment (Microsoft Learn, BizTalk Server)): a binding ties a logical endpoint, such as an orchestration port, to a physical one, such as a send port, a receive port or a party.
- `messageBoxToBroker` (Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)): routing through the MessageBox is redesigned with a broker such as Service Bus topics and subscriptions, not rebuilt inside a workflow.

The tool's own choice: a static or dynamic send port with no filter statement, that no orchestration port of the binding files names and that is in no send port group with a filter, receives no message; it may be bound in another application, so a warning.

What to change: remove the send port if it is not used, or name the subscription it serves so the move can route it, such as a Service Bus subscription.

### `disabled-receive-location`

A receive location is disabled.

- `adapterRole` (Adapters in BizTalk Server (Microsoft Learn)): an adapter sends messages out of BizTalk Server or receives them into it over one transport, and each receive location listens on one transport at one address.

The tool's own choice: a receive location whose Enable is false receives nothing; info, because it may be kept on purpose.

What to change: decide whether the receive location is still needed; leave it out of the move if it is not.

### `duplicate-address`

Two receive locations or two send ports use the same address.

- `adapterRole` (Adapters in BizTalk Server (Microsoft Learn)): an adapter sends messages out of BizTalk Server or receives them into it over one transport, and each receive location listens on one transport at one address.

The tool's own choice: addresses are compared with the adapter, trimmed, with the letters A to Z lowered, back slashes read as forward slashes and a trailing slash left out; receive locations are compared with receive locations and send ports with send ports, across all the files of a run; an empty address is not compared.

What to change: give each receive location and send port its own address, or keep one of them.

### `plain-text-credential`

A credential is in the binding file in plain text.

- `exportNoPasswords` (Exporting Bindings (Microsoft Learn, BizTalk Server)): BizTalk Server takes the passwords out of a binding file when it exports one, so they must be set again after an import, and the file may still hold sensitive data that must be kept safe.

The tool's own choice: an element or attribute whose name is that of a secret (docs/method.md) with a value, in the binding file or in the transport, pipeline or filter settings inside it, and the password of an address or the secret part of a connection string; the value is never shown, and the tool cannot tell whether it is still valid.

What to change: take the value out of the binding file, rotate it, and keep it in Azure Key Vault or behind a managed identity in the target.

### `dynamic-send-port`

A send port is dynamic.

- `adaptersToConnectors` (Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)): adapters are replaced by built-in, managed or custom connectors and APIs, once the connector, its authentication, its throughput and its hosting are confirmed.
- `bindingEndpoints` (Binding Files and Application Deployment (Microsoft Learn, BizTalk Server)): a binding ties a logical endpoint, such as an orchestration port, to a physical one, such as a send port, a receive port or a party.

The tool's own choice: a send port whose IsStatic is false has its adapter and address set at run time by an orchestration or a pipeline, so neither is in the binding file.

What to change: list the adapters and addresses the port is given at run time, from the orchestration or pipeline that sets them, and map each one.

### `invalid-artifact`

An artifact that cannot be read.

- `bindingContents` (Binding Files and Application Deployment (Microsoft Learn, BizTalk Server)): a binding file is an XML file that records the host of each orchestration and the settings of each send port, send port group, receive port, receive location and party of an assembly, an application or a group.

The tool's own choice: a receive port, receive location, send port, orchestration or party with no name, a static send port or a receive location with no adapter, and transport, pipeline or filter settings that are not XML the reader accepts are not checked in full; this rule cannot be set lower or off.

What to change: export the bindings again, or correct the element at the line named.

### `unreadable-file`

A file that cannot be read.

- `bindingContents` (Binding Files and Application Deployment (Microsoft Learn, BizTalk Server)): a binding file is an XML file that records the host of each orchestration and the settings of each send port, send port group, receive port, receive location and party of an assembly, an application or a group.
- `xxeDenialOfService` (XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series)): stopping external entities does not stop every denial of service; entity expansion such as the billion laughs attack needs limits of its own.

The tool's own choice: a file that is over its size limit, binary, not valid UTF-8 or UTF-16, or not there to open is an error and nothing in it is checked; this rule cannot be set lower or off.

What to change: export the bindings again from the BizTalk Server Administration console or BTSTask.

### `unparsable-file`

A file that is not XML the reader accepts, or not a binding file.

- `xxeRejectDoctype` (XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series)): the safest way to prevent XML external entity attacks is to turn document type definitions off entirely, and a reader that can refuse a DOCTYPE declaration should refuse it.
- `xxeDenialOfService` (XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series)): stopping external entities does not stop every denial of service; entity expansion such as the billion laughs attack needs limits of its own.
- `exportScope` (Exporting Bindings (Microsoft Learn, BizTalk Server)): bindings tie hosts, send ports, send port groups, receive ports, receive locations and parties to orchestrations, pipelines, maps and schemas, and are exported to an XML file for a group, an assembly or an application.

The tool's own choice: a DOCTYPE or ENTITY declaration, an entity the tool does not know, XML that is not well formed, nested too deep or too large, or a root element other than BindingInfo stops the reading of the file, and nothing in it is checked; this rule cannot be set lower or off.

What to change: export the bindings again, and take any DOCTYPE or entity declaration out of the file.

## The points

| Point | Page | What it says |
| --- | --- | --- |
| `bindingContents` | Binding Files and Application Deployment (Microsoft Learn, BizTalk Server) | a binding file is an XML file that records the host of each orchestration and the settings of each send port, send port group, receive port, receive location and party of an assembly, an application or a group |
| `bindingEndpoints` | Binding Files and Application Deployment (Microsoft Learn, BizTalk Server) | a binding ties a logical endpoint, such as an orchestration port, to a physical one, such as a send port, a receive port or a party |
| `exportScope` | Exporting Bindings (Microsoft Learn, BizTalk Server) | bindings tie hosts, send ports, send port groups, receive ports, receive locations and parties to orchestrations, pipelines, maps and schemas, and are exported to an XML file for a group, an assembly or an application |
| `exportNoPasswords` | Exporting Bindings (Microsoft Learn, BizTalk Server) | BizTalk Server takes the passwords out of a binding file when it exports one, so they must be set again after an import, and the file may still hold sensitive data that must be kept safe |
| `nativeAdapters` | Adapters in BizTalk Server (Microsoft Learn) | the native adapters are FILE, FTP, HTTP, MQSeries, MSMQ, POP3, SMTP, SOAP, Windows SharePoint Services and seven WCF adapters, and custom adapters are built with the BizTalk Adapter Framework |
| `adapterRole` | Adapters in BizTalk Server (Microsoft Learn) | an adapter sends messages out of BizTalk Server or receives them into it over one transport, and each receive location listens on one transport at one address |
| `logicAppsSuccessor` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | Azure Logic Apps is named the successor of BizTalk Server, and Logic Apps Standard is the target for most BizTalk modernization work |
| `orchestrationsToWorkflows` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | orchestrations are refactored into stateful or stateless Logic Apps Standard workflows |
| `pipelinesToCode` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | pipelines and helper code move to workflow actions, .NET local functions, inline code, custom connectors or external services such as Azure Functions |
| `adaptersToConnectors` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | adapters are replaced by built-in, managed or custom connectors and APIs, once the connector, its authentication, its throughput and its hosting are confirmed |
| `b2bToIntegrationAccount` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | EDI and B2B move to Standard workflows, connectors and integration accounts, once the partners, agreements, certificates and protocols are assessed |
| `messageBoxToBroker` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | routing through the MessageBox is redesigned with a broker such as Service Bus topics and subscriptions, not rebuilt inside a workflow |
| `mapsToTransforms` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | schemas and maps are reused where they are compatible, as XSLT maps, Liquid templates or Data Mapper maps, and the transformations are tested again |
| `biztalkLifecycle` | Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn) | the current BizTalk Server release is the last one; the page gives the end of sale, the end of mainstream support and a paid extended support offer meant as time to migrate |
| `fixedLifecycle` | Fixed Lifecycle Policy (Microsoft Learn) | under the Fixed Lifecycle Policy, mainstream support brings security and other updates, while extended support brings security updates only, with no new features or design changes |
| `aisServices` | Get Started with Integration Architecture Design (Azure Architecture Center) | the Azure services for integration are API Management, Logic Apps, Service Bus, Event Grid, Functions and Data Factory |
| `builtInConnectors` | Built-In Connectors Overview, Azure Logic Apps (Microsoft Learn) | a Standard workflow has built-in connectors that run in the Logic Apps runtime, among them File System, FTP, SFTP, SMTP, SQL Server, IBM MQ, SAP, Service Bus, Blob Storage and Azure Functions |
| `managedConnectors` | Managed Connectors Overview, Azure Logic Apps (Microsoft Learn) | managed connectors are run by Microsoft in Azure, such as Office 365 Outlook, SharePoint and SFTP-SSH, with enterprise connectors for SAP and IBM MQ and a data gateway for systems on the premises |
| `xxeRejectDoctype` | XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series) | the safest way to prevent XML external entity attacks is to turn document type definitions off entirely, and a reader that can refuse a DOCTYPE declaration should refuse it |
| `xxeDenialOfService` | XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series) | stopping external entities does not stop every denial of service; entity expansion such as the billion laughs attack needs limits of its own |
| `csvRecords` | RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files | each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice |
| `csvInjection` | CSV Injection (OWASP) | a spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file |
| `jsonUtf8` | RFC 8259, The JSON Data Interchange Format | JSON text exchanged between systems must be UTF-8, and a reader may ignore a byte order mark at the start |
| `jsonRepeatedNames` | RFC 8259, The JSON Data Interchange Format | when an object repeats a name the behavior of the software that reads it cannot be predicted, so the reader of this tool refuses a repeated name |
| `githubAnnotations` | Workflow commands for GitHub Actions (GitHub Docs) | a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run |

## The pages

- Binding Files and Application Deployment (Microsoft Learn, BizTalk Server): https://learn.microsoft.com/en-us/biztalk/core/binding-files-and-application-deployment
- Exporting Bindings (Microsoft Learn, BizTalk Server): https://learn.microsoft.com/en-us/biztalk/core/exporting-bindings6
- Adapters in BizTalk Server (Microsoft Learn): https://learn.microsoft.com/en-us/biztalk/core/adapters-in-biztalk-server
- Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn): https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-migration-overview
- Fixed Lifecycle Policy (Microsoft Learn): https://learn.microsoft.com/en-us/lifecycle/policies/fixed
- Get Started with Integration Architecture Design (Azure Architecture Center): https://learn.microsoft.com/en-us/azure/architecture/integration/integration-get-started
- Built-In Connectors Overview, Azure Logic Apps (Microsoft Learn): https://learn.microsoft.com/en-us/azure/connectors/built-in
- Managed Connectors Overview, Azure Logic Apps (Microsoft Learn): https://learn.microsoft.com/en-us/azure/connectors/managed
- XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series): https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html
- RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files: https://www.rfc-editor.org/rfc/rfc4180
- RFC 8259, The JSON Data Interchange Format: https://www.rfc-editor.org/rfc/rfc8259
- CSV Injection (OWASP): https://community.owasp.org/attacks/CSV_Injection
- Workflow commands for GitHub Actions (GitHub Docs): https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
