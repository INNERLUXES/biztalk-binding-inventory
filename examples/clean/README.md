# Tamberly Mills: a small export in good order

A made-up flour mill whose invoicing application, `Tamberly.Invoicing`, has one FILE receive location and two send
ports, one to an SFTP server and one to a Service Bus queue, each with a filter. Every adapter has a mapped target,
every pipeline comes with BizTalk Server, and the passwords and keys are empty, as an export leaves them. The run
passes with no finding.

```
node bin/biztalk-binding-inventory.js examples/clean/Tamberly.Invoicing.BindingInfo.xml
```
