// The suggested Azure target of each adapter and of each kind of artifact, kept as a documented data file. Each entry
// names the points of the public pages it rests on (src/data.js). The adapters are named as the TransportType of a
// binding file names them and compared trimmed with the letters A to Z lowered (src/words.js adapterForm). The
// adapterTargets key of the configuration adds an adapter or replaces the target of one (docs/inputs.md).
//
// A target is a place to start the design of the move, not a decision: the migration page says to confirm that a
// connector is there, how it authenticates, its throughput and its hosting before an adapter is replaced.
// Check the list before you rely on it; Azure adds and renames connectors, and a team may choose another target.

export const ADAPTER_TARGETS = [
  { adapters: ['FILE'], target: 'Logic Apps File System connector or Azure Blob Storage', basis: ['builtInConnectors', 'adaptersToConnectors'] },
  { adapters: ['FTP'], target: 'Logic Apps SFTP connector (or the FTP connector while the partner stays on FTP)', basis: ['builtInConnectors', 'adaptersToConnectors'] },
  { adapters: ['SFTP'], target: 'Logic Apps SFTP connector', basis: ['builtInConnectors', 'managedConnectors'] },
  { adapters: ['HTTP', 'SOAP', 'WCF-BasicHttp', 'WCF-WSHttp', 'WCF-WebHttp', 'WCF-BasicHttpRelay'], target: 'API Management + Logic Apps or Azure Functions', basis: ['aisServices', 'adaptersToConnectors'] },
  { adapters: ['WCF-SQL', 'SQL'], target: 'Logic Apps SQL Server connector', basis: ['builtInConnectors', 'managedConnectors'] },
  { adapters: ['MQSeries', 'MQSC'], target: 'Logic Apps IBM MQ connector', basis: ['builtInConnectors', 'managedConnectors'] },
  { adapters: ['SB-Messaging'], target: 'Azure Service Bus', basis: ['aisServices', 'builtInConnectors'] },
  { adapters: ['SAP', 'WCF-SAP'], target: 'Logic Apps SAP connector', basis: ['builtInConnectors', 'managedConnectors'] },
  { adapters: ['MSMQ', 'WCF-NetMsmq'], target: 'Azure Service Bus queues', basis: ['aisServices', 'messageBoxToBroker'] },
  { adapters: ['SMTP'], target: 'Logic Apps SMTP or Office 365 Outlook connector', basis: ['builtInConnectors', 'managedConnectors'] },
  { adapters: ['POP3'], target: 'Logic Apps Office 365 Outlook connector', basis: ['managedConnectors'] },
  { adapters: ['Windows SharePoint Services'], target: 'Logic Apps SharePoint connector', basis: ['managedConnectors'] },
  { adapters: ['LogicApp'], target: 'Logic Apps Standard workflow (called directly)', basis: ['logicAppsSuccessor'] }
];

// The target of an orchestration, of a party, of the code of a custom pipeline, of an EDI or AS2 pipeline, and of a
// dynamic send port, whose adapter is chosen at run time.
export const ORCHESTRATION_TARGET = 'Logic Apps Standard workflow';
export const PARTY_TARGET = 'Logic Apps integration account B2B (trading partner and agreements)';
export const CUSTOM_CODE_TARGET = 'Azure Functions (custom pipeline code)';
export const B2B_TARGET = 'Logic Apps integration account B2B (AS2, X12, EDIFACT)';
export const DYNAMIC_TARGET = 'Logic Apps Standard workflow that picks the connector (the adapter is chosen at run time)';
// What an artifact whose adapter is in no entry gets.
export const NO_TARGET = 'no mapped target';

// The points behind the targets that are not adapters.
export const KIND_BASIS = {
  orchestration: ['orchestrationsToWorkflows', 'logicAppsSuccessor'],
  party: ['b2bToIntegrationAccount'],
  customCode: ['pipelinesToCode'],
  b2b: ['b2bToIntegrationAccount'],
  dynamic: ['adaptersToConnectors']
};

// The names of pipelines and pipeline components that come with BizTalk Server, as the start of their type names. A
// pipeline or a component whose name starts with none of them is custom code. The builtInPrefixes key of the
// configuration adds more.
export const BUILT_IN_PREFIXES = ['Microsoft.BizTalk.DefaultPipelines.', 'Microsoft.BizTalk.Edi.', 'Microsoft.BizTalk.Component.'];

// The start of the names of the EDI and AS2 pipelines that come with BizTalk Server: a port that uses one is B2B.
export const B2B_PREFIXES = ['Microsoft.BizTalk.Edi.'];
