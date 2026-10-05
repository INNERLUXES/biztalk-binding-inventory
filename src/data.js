// The public pages the inventory rests on, and what each says, written in this project's own words. research/sources.md
// lists every page with a longer note on each, and test/data.test.js checks that every page here is listed there and
// that every rule and every target names points that exist. The code in src/ uses these constants and never writes a
// reason of its own in a report. The suggested targets are in src/targets.js.

const LEARN = 'https://learn.microsoft.com/en-us';

export const SOURCES = [
  { id: 'bindingFiles', title: 'Binding Files and Application Deployment (Microsoft Learn, BizTalk Server)', url: `${LEARN}/biztalk/core/binding-files-and-application-deployment` },
  { id: 'exportingBindings', title: 'Exporting Bindings (Microsoft Learn, BizTalk Server)', url: `${LEARN}/biztalk/core/exporting-bindings6` },
  { id: 'adapters', title: 'Adapters in BizTalk Server (Microsoft Learn)', url: `${LEARN}/biztalk/core/adapters-in-biztalk-server` },
  { id: 'migration', title: 'Why Move from BizTalk Server to Azure Logic Apps Standard? (Microsoft Learn)', url: `${LEARN}/azure/logic-apps/biztalk-server-migration-overview` },
  { id: 'lifecycle', title: 'Fixed Lifecycle Policy (Microsoft Learn)', url: `${LEARN}/lifecycle/policies/fixed` },
  { id: 'integrationServices', title: 'Get Started with Integration Architecture Design (Azure Architecture Center)', url: `${LEARN}/azure/architecture/integration/integration-get-started` },
  { id: 'builtInConnectors', title: 'Built-In Connectors Overview, Azure Logic Apps (Microsoft Learn)', url: `${LEARN}/azure/connectors/built-in` },
  { id: 'managedConnectors', title: 'Managed Connectors Overview, Azure Logic Apps (Microsoft Learn)', url: `${LEARN}/azure/connectors/managed` },
  { id: 'owaspXxe', title: 'XML External Entity Prevention Cheat Sheet (OWASP Cheat Sheet Series)', url: 'https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html' },
  { id: 'rfc4180', title: 'RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files', url: 'https://www.rfc-editor.org/rfc/rfc4180' },
  { id: 'rfc8259', title: 'RFC 8259, The JSON Data Interchange Format', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
  { id: 'owaspCsv', title: 'CSV Injection (OWASP)', url: 'https://community.owasp.org/attacks/CSV_Injection' },
  { id: 'githubCommands', title: 'Workflow commands for GitHub Actions (GitHub Docs)', url: 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// What a page says, in this project's own words. Each point names its page.
export const POINTS = {
  bindingContents: { source: 'bindingFiles', text: 'a binding file is an XML file that records the host of each orchestration and the settings of each send port, send port group, receive port, receive location and party of an assembly, an application or a group' },
  bindingEndpoints: { source: 'bindingFiles', text: 'a binding ties a logical endpoint, such as an orchestration port, to a physical one, such as a send port, a receive port or a party' },
  exportScope: { source: 'exportingBindings', text: 'bindings tie hosts, send ports, send port groups, receive ports, receive locations and parties to orchestrations, pipelines, maps and schemas, and are exported to an XML file for a group, an assembly or an application' },
  exportNoPasswords: { source: 'exportingBindings', text: 'BizTalk Server takes the passwords out of a binding file when it exports one, so they must be set again after an import, and the file may still hold sensitive data that must be kept safe' },
  nativeAdapters: { source: 'adapters', text: 'the native adapters are FILE, FTP, HTTP, MQSeries, MSMQ, POP3, SMTP, SOAP, Windows SharePoint Services and seven WCF adapters, and custom adapters are built with the BizTalk Adapter Framework' },
  adapterRole: { source: 'adapters', text: 'an adapter sends messages out of BizTalk Server or receives them into it over one transport, and each receive location listens on one transport at one address' },
  logicAppsSuccessor: { source: 'migration', text: 'Azure Logic Apps is named the successor of BizTalk Server, and Logic Apps Standard is the target for most BizTalk modernization work' },
  orchestrationsToWorkflows: { source: 'migration', text: 'orchestrations are refactored into stateful or stateless Logic Apps Standard workflows' },
  pipelinesToCode: { source: 'migration', text: 'pipelines and helper code move to workflow actions, .NET local functions, inline code, custom connectors or external services such as Azure Functions' },
  adaptersToConnectors: { source: 'migration', text: 'adapters are replaced by built-in, managed or custom connectors and APIs, once the connector, its authentication, its throughput and its hosting are confirmed' },
  b2bToIntegrationAccount: { source: 'migration', text: 'EDI and B2B move to Standard workflows, connectors and integration accounts, once the partners, agreements, certificates and protocols are assessed' },
  messageBoxToBroker: { source: 'migration', text: 'routing through the MessageBox is redesigned with a broker such as Service Bus topics and subscriptions, not rebuilt inside a workflow' },
  mapsToTransforms: { source: 'migration', text: 'schemas and maps are reused where they are compatible, as XSLT maps, Liquid templates or Data Mapper maps, and the transformations are tested again' },
  biztalkLifecycle: { source: 'migration', text: 'the current BizTalk Server release is the last one; the page gives the end of sale, the end of mainstream support and a paid extended support offer meant as time to migrate' },
  fixedLifecycle: { source: 'lifecycle', text: 'under the Fixed Lifecycle Policy, mainstream support brings security and other updates, while extended support brings security updates only, with no new features or design changes' },
  aisServices: { source: 'integrationServices', text: 'the Azure services for integration are API Management, Logic Apps, Service Bus, Event Grid, Functions and Data Factory' },
  builtInConnectors: { source: 'builtInConnectors', text: 'a Standard workflow has built-in connectors that run in the Logic Apps runtime, among them File System, FTP, SFTP, SMTP, SQL Server, IBM MQ, SAP, Service Bus, Blob Storage and Azure Functions' },
  managedConnectors: { source: 'managedConnectors', text: 'managed connectors are run by Microsoft in Azure, such as Office 365 Outlook, SharePoint and SFTP-SSH, with enterprise connectors for SAP and IBM MQ and a data gateway for systems on the premises' },
  xxeRejectDoctype: { source: 'owaspXxe', text: 'the safest way to prevent XML external entity attacks is to turn document type definitions off entirely, and a reader that can refuse a DOCTYPE declaration should refuse it' },
  xxeDenialOfService: { source: 'owaspXxe', text: 'stopping external entities does not stop every denial of service; entity expansion such as the billion laughs attack needs limits of its own' },
  csvRecords: { source: 'rfc4180', text: 'each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice' },
  csvInjection: { source: 'owaspCsv', text: 'a spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file' },
  jsonUtf8: { source: 'rfc8259', text: 'JSON text exchanged between systems must be UTF-8, and a reader may ignore a byte order mark at the start' },
  jsonRepeatedNames: { source: 'rfc8259', text: 'when an object repeats a name the behavior of the software that reads it cannot be predicted, so the reader of this tool refuses a repeated name' },
  githubAnnotations: { source: 'githubCommands', text: 'a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run' }
};

// The page of a point.
export const pointPage = (key) => source(POINTS[key].source);

// The levels of a finding, from the lowest.
export const LEVELS = ['info', 'warning', 'error'];

// The sentence every report ends with, before the result.
export const NOTICE = 'This inventory reads the binding files as they are written. It connects to no BizTalk group and no Azure service, and its targets are suggestions to review, not a migration plan and not a certification (docs/limits.md).';
