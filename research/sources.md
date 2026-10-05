# Sources

The public pages the inventory of this tool is based on, each with a short note in this project's own words on what
the page says and which parts of the tool lean on it. Nothing here is a copy of a page: read the page itself for its
exact wording. src/data.js holds the pages and the points the reports show, src/targets.js holds the suggested targets,
and test/data.test.js checks that every page in src/data.js is listed here.
Each page was fetched and read before it was listed.

The tool reads binding files; it is not a migration plan and not a certification. These notes say what the pages say
so a reader can follow a finding or a target back to its source; they are not advice on how to move any one
application.

## BizTalk Server binding files

### Binding Files and Application Deployment (Microsoft Learn, BizTalk Server)

https://learn.microsoft.com/en-us/biztalk/core/binding-files-and-application-deployment

The page explains what a binding is: a link from a logical endpoint, such as a port of an orchestration or a role link,
to a physical one, such as a send port, a receive port or a party. A binding file is an XML file that holds this
information for every orchestration, pipeline, map and schema in the scope of an assembly, an application or a group:
the host each orchestration is bound to with its trust level, and the settings of each send port, send port group,
receive port, receive location and party. The page describes why binding files are used (moving an application between
environments, updating an assembly, deploying to several groups), that they are made by exporting bindings and can be
edited, and that on import a binding of the same name as an existing one replaces it. The tool reads the elements the
page names; `invalid-artifact` and the reading of orchestrations, ports and parties lean on it, and `orphan-send-port`
and `dynamic-send-port` lean on the idea of a binding as the link between logical and physical endpoints.

### Exporting Bindings (Microsoft Learn, BizTalk Server)

https://learn.microsoft.com/en-us/biztalk/core/exporting-bindings6

The page on exporting the bindings of a group, an assembly or an application to an XML file, and importing them into
another group or application. It says that bindings tie hosts, send ports, send port groups, receive ports, receive
locations and parties to orchestrations, pipelines, maps and schemas. It warns that a binding file may hold sensitive
data and should be kept safe, and it notes that BizTalk Server removes the passwords of the bindings when it exports a
file, so the passwords of send ports and receive locations must be set again after an import. `plain-text-credential`
leans on this note: a password in an export was put back by someone, and the tool reports where it is without showing
it. `unparsable-file` leans on the scope of an export for the root element it expects.

### Adapters in BizTalk Server (Microsoft Learn)

https://learn.microsoft.com/en-us/biztalk/core/adapters-in-biztalk-server

The page describes an adapter as a component that sends messages out of or receives messages into BizTalk Server over a
transport that follows a common standard, such as SMTP, POP3, FTP or Message Queuing. It lists the native adapters
installed with the product (FILE, FTP, HTTP, MQSeries, MSMQ, POP3, SMTP, SOAP, Windows SharePoint Services and seven
WCF adapters: WCF-WSHttp, WCF-BasicHttp, WCF-NetTcp, WCF-NetMsmq, WCF-NetNamedPipe, WCF-Custom and WCF-CustomIsolated),
says that custom adapters are built with the BizTalk Adapter Framework, and that each receive location listens for one
transport at one address. A table gives each native adapter's transaction, two-way and ordered delivery support and its
hosting process, and the page also lists the line of business adapters and the Adapter Pack. The adapter names of
src/targets.js follow the names this page and the binding files use; `unmapped-adapter`, `disabled-receive-location`
and `duplicate-address` lean on it.

## The move to Azure

### Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)

https://learn.microsoft.com/en-us/azure/logic-apps/biztalk-server-migration-overview

The migration overview for BizTalk Server on Microsoft Learn. It names Azure Logic Apps as the successor of BizTalk
Server and Logic Apps Standard as the resource type for most BizTalk work. Its section on the BizTalk Server lifecycle
says that the current release is the last one, gives the end of sale and the end of mainstream support, and describes a
paid extended support offer meant as time to migrate; this project does not repeat the dates, which change, and points
to the page. A table maps BizTalk capabilities to their paths: orchestrations to stateful or stateless Standard
workflows, pipelines and helper code to workflow actions, .NET local functions, inline code, custom connectors or
external services, MessageBox routing to a broker such as Service Bus topics and subscriptions, schemas and maps to XSLT,
Liquid or Data Mapper, EDI and B2B to Standard workflows with integration accounts, and adapters to built-in, managed or
custom connectors once the connector, its authentication, throughput and hosting are confirmed. It also says that
custom code does not always need a separate Azure Functions resource, and that Key Vault and managed identities keep
credentials out of workflows. The targets of src/targets.js, `orchestration`, `custom-pipeline`, `unmapped-adapter`,
`orphan-send-port` and `dynamic-send-port` lean on it.

### Fixed Lifecycle Policy (Microsoft Learn)

https://learn.microsoft.com/en-us/lifecycle/policies/fixed

The policy that BizTalk Server follows, as the migration overview says. It gives a product at least five years of
mainstream support, which brings incident support, security updates and the chance to ask for other updates, followed
for some products by extended support, which brings security updates only and no design changes or new features. The
lifecycle page of BizTalk Server itself has the version and its year in its address, so this project names the policy
page and the migration overview instead. The README leans on it for why an inventory is worth making; no rule does.

### Get Started with Integration Architecture Design (Azure Architecture Center)

https://learn.microsoft.com/en-us/azure/architecture/integration/integration-get-started

The Azure Architecture Center page on integration. It lists the Azure services for integration: API Management to
publish APIs to back-end systems, Logic Apps for workflows across cloud and on-premises services, Service Bus for
messaging between applications, Event Grid for events, Functions for event-driven code, and Data Factory for data
movement, and it shows a basic architecture of API Management in front of Logic Apps. The page refers to these as Azure
Integration Services. The targets for HTTP and SOAP adapters (API Management with Logic Apps or Functions) and for
queues (Service Bus) lean on it.

### Built-In Connectors Overview, Azure Logic Apps (Microsoft Learn)

https://learn.microsoft.com/en-us/azure/connectors/built-in

The page on the connectors that run inside the Logic Apps runtime. It says that a Standard workflow has built-in
versions for Blob Storage, Cosmos DB, Event Hubs, Service Bus, FTP, IBM DB2, IBM MQ, SFTP and SQL Server next to their
managed versions, and lists the built-in connectors of Standard workflows, among them File System, FTP, SFTP, SMTP,
SQL Server, IBM MQ, SAP, Service Bus, Blob Storage, Azure Functions, AS2, X12 and EDIFACT, with integration accounts for
B2B artifacts such as partners and agreements. The targets for FILE, FTP, SFTP, WCF-SQL, MQSeries, SAP, SMTP and
SB-Messaging lean on it.

### Managed Connectors Overview, Azure Logic Apps (Microsoft Learn)

https://learn.microsoft.com/en-us/azure/connectors/managed

The page on the connectors Microsoft runs in Azure. Managed connectors reach services such as Office 365 Outlook,
SharePoint, Salesforce and SFTP-SSH; enterprise connectors reach SAP, IBM MQ and IBM 3270 at an extra cost; connectors
for systems on the premises, such as SQL Server, SAP and file shares, need an on-premises data gateway; and integration
account connectors handle AS2, X12 and EDIFACT. The page also names a BizTalk Server connector. The targets for POP3,
SMTP and Windows SharePoint Services lean on it.

## Reading XML safely

### XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series)

https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html

The OWASP guide to XML external entity attacks. Its main advice is to turn document type definitions off entirely,
and to refuse a DOCTYPE declaration where the parser can; where that is not possible, external entities and entity
expansion must be turned off. It notes that stopping external entities does not stop every denial of service, and
names entity expansion such as the billion laughs attack as needing protection of its own. The XML reader of this tool
is its own and reads no document type definition at all: a DOCTYPE or ENTITY declaration and any entity but the five
XML predefines are refused, and the depth, the number of elements and the length of text are limited
(`unparsable-file`, docs/threat-model.md).

## Formats

### RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files

https://www.rfc-editor.org/rfc/rfc4180

The memo that describes CSV: each record on its own line, ended by CRLF, an optional header line first, fields
separated by commas, spaces kept as part of a field, and every line with the same number of fields. A field that holds
a comma, a double quote or a line break is put in double quotes, and a double quote inside such a field is written
twice. `--format csv` writes the inventory this way, one record per artifact, with CRLF line ends.

### RFC 8259, The JSON Data Interchange Format

https://www.rfc-editor.org/rfc/rfc8259

The JSON standard. Its section on objects says the names in an object should be unique and that programs behave in
different ways when they are not; the reader of the configuration refuses a repeated name instead of keeping one of
the values. Its section on encoding asks for UTF-8 between systems and lets a reader ignore a byte order mark; the
configuration is read as UTF-8 and a byte order mark is skipped.

### CSV Injection (OWASP)

https://community.owasp.org/attacks/CSV_Injection

The page on formulas hidden in CSV files. A spreadsheet may treat a cell that starts with `=`, `+`, `-`, `@`, a tab or
a line break as a formula, and the page warns that no single way of escaping is safe in every program and for every
later reader. The CSV format of the tool puts a single quote in front of such a field, and docs/threat-model.md says
why that is a help and not a guarantee.

### Workflow commands for GitHub Actions (GitHub Docs)

https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

The page that describes the `::notice`, `::warning` and `::error` commands with their `file`, `line`, `col` and
`title` properties, which turn a line of output into an annotation on a file. `--format github` writes one such command
per finding, info as a notice, and escapes the characters a command gives a meaning to.
