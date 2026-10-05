// The rules and the result. Each rule names the points of the public pages it rests on (src/data.js), says where it is
// the tool's own choice, and what to change. docs/method.md says exactly what each rule looks at and what it cannot see.
// The checks themselves are in src/bindings.js and src/inventory.js.

import { LEVELS } from './data.js';
import { grouped, plural } from './size.js';

export const RULES = [
  {
    id: 'unmapped-adapter',
    key: 'unmappedAdapter',
    title: 'an adapter has no mapped Azure target',
    basis: ['nativeAdapters', 'adaptersToConnectors', 'builtInConnectors', 'managedConnectors'],
    own: 'the targets are the table of src/targets.js and the adapterTargets of the configuration; an adapter in neither, such as a custom adapter or WCF-Custom, whose binding decides what it does, is reported; the receive location or send port is still listed',
    rule: (config) => `a receive location or send port whose adapter (or backup adapter) is none of the ${plural(config.targetCount, 'adapter')} with a target`,
    fix: 'choose the Azure connector or service for the adapter and add it to adapterTargets in the configuration, or plan a custom connector'
  },
  {
    id: 'custom-pipeline',
    key: 'customPipeline',
    title: 'a port uses a custom pipeline or pipeline component',
    basis: ['pipelinesToCode'],
    own: 'a pipeline or a component named in the per-instance pipeline settings whose type name starts with none of the built-in prefixes of src/targets.js and builtInPrefixes is custom code; the binding file names the components only when the pipeline settings were changed for the port, so a custom pipeline is reported even when its components are not listed',
    rule: () => 'a receive location or send port with a pipeline, or a pipeline component in its pipeline settings, that does not come with BizTalk Server',
    fix: 'rewrite the custom pipeline code as an Azure Function, a .NET local function or a workflow action, or replace it with a built-in operation such as Flat File or XML'
  },
  {
    id: 'orchestration',
    key: 'orchestration',
    title: 'an orchestration needs a redesign',
    basis: ['orchestrationsToWorkflows', 'logicAppsSuccessor'],
    own: 'every orchestration is reported once, with the count of orchestrations of its application, because its logic is in the assembly and not in the binding file; info by default, because it is work to plan, not a fault',
    rule: () => 'every orchestration of the binding files',
    fix: 'redesign the orchestration as a Logic Apps Standard workflow, and move its ports to triggers and actions'
  },
  {
    id: 'orphan-send-port',
    key: 'orphanSendPort',
    title: 'a send port has no filter and no orchestration bound to it',
    basis: ['bindingEndpoints', 'messageBoxToBroker'],
    own: 'a static or dynamic send port with no filter statement, that no orchestration port of the binding files names and that is in no send port group with a filter, receives no message; it may be bound in another application, so a warning',
    rule: () => 'a send port with no filter, named by no orchestration port and in no send port group with a filter',
    fix: 'remove the send port if it is not used, or name the subscription it serves so the move can route it, such as a Service Bus subscription'
  },
  {
    id: 'disabled-receive-location',
    key: 'disabledReceiveLocation',
    title: 'a receive location is disabled',
    basis: ['adapterRole'],
    own: 'a receive location whose Enable is false receives nothing; info, because it may be kept on purpose',
    rule: () => 'a receive location whose Enable is false',
    fix: 'decide whether the receive location is still needed; leave it out of the move if it is not'
  },
  {
    id: 'duplicate-address',
    key: 'duplicateAddress',
    title: 'two receive locations or two send ports use the same address',
    basis: ['adapterRole'],
    own: 'addresses are compared with the adapter, trimmed, with the letters A to Z lowered, back slashes read as forward slashes and a trailing slash left out; receive locations are compared with receive locations and send ports with send ports, across all the files of a run; an empty address is not compared',
    rule: () => 'a receive location or send port with the adapter and address of an earlier one of the same kind',
    fix: 'give each receive location and send port its own address, or keep one of them'
  },
  {
    id: 'plain-text-credential',
    key: 'plainTextCredential',
    title: 'a credential is in the binding file in plain text',
    basis: ['exportNoPasswords'],
    own: 'an element or attribute whose name is that of a secret (docs/method.md) with a value, in the binding file or in the transport, pipeline or filter settings inside it, and the password of an address or the secret part of a connection string; the value is never shown, and the tool cannot tell whether it is still valid',
    rule: () => 'a value in a setting named like a password, secret, key or token, a password in an address, or a secret in a connection string',
    fix: 'take the value out of the binding file, rotate it, and keep it in Azure Key Vault or behind a managed identity in the target'
  },
  {
    id: 'dynamic-send-port',
    key: 'dynamicSendPort',
    title: 'a send port is dynamic',
    basis: ['adaptersToConnectors', 'bindingEndpoints'],
    own: 'a send port whose IsStatic is false has its adapter and address set at run time by an orchestration or a pipeline, so neither is in the binding file',
    rule: () => 'a send port whose IsStatic is false',
    fix: 'list the adapters and addresses the port is given at run time, from the orchestration or pipeline that sets them, and map each one'
  },
  {
    id: 'invalid-artifact',
    key: null,
    title: 'an artifact that cannot be read',
    basis: ['bindingContents'],
    own: 'a receive port, receive location, send port, orchestration or party with no name, a static send port or a receive location with no adapter, and transport, pipeline or filter settings that are not XML the reader accepts are not checked in full; this rule cannot be set lower or off',
    rule: () => 'an artifact with no name or no adapter, or settings inside it that cannot be read',
    fix: 'export the bindings again, or correct the element at the line named'
  },
  {
    id: 'unreadable-file',
    key: null,
    title: 'a file that cannot be read',
    basis: ['bindingContents', 'xxeDenialOfService'],
    own: 'a file that is over its size limit, binary, not valid UTF-8 or UTF-16, or not there to open is an error and nothing in it is checked; this rule cannot be set lower or off',
    rule: () => 'a binding file that the tool could not read as UTF-8 or UTF-16 text',
    fix: 'export the bindings again from the BizTalk Server Administration console or BTSTask'
  },
  {
    id: 'unparsable-file',
    key: null,
    title: 'a file that is not XML the reader accepts, or not a binding file',
    basis: ['xxeRejectDoctype', 'xxeDenialOfService', 'exportScope'],
    own: 'a DOCTYPE or ENTITY declaration, an entity the tool does not know, XML that is not well formed, nested too deep or too large, or a root element other than BindingInfo stops the reading of the file, and nothing in it is checked; this rule cannot be set lower or off',
    rule: () => 'a binding file that the XML reader refuses, or whose root element is not BindingInfo',
    fix: 'export the bindings again, and take any DOCTYPE or entity declaration out of the file'
  }
];

export const ruleById = (id) => RULES.find((r) => r.id === id);

// True when a level is at or above another.
export const atOrAbove = (level, min) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

// The result: the run fails when a finding is at or above the level failOn. { pass, failOn, failing, byLevel, text }.
export function decide(findings, failOn) {
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of findings) byLevel[f.level] += 1;
  const failing = findings.filter((f) => atOrAbove(f.level, failOn)).length;
  const counts = ['error', 'warning', 'info'].filter((l) => byLevel[l]).map((l) => `${grouped(byLevel[l])} ${l}`);
  const text = failing
    ? `FAIL - ${plural(failing, 'finding')} at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`
    : `PASS - no finding at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`;
  return { pass: failing === 0, failOn, failing, byLevel, text };
}
