# Quillmoor Logistics: a messy binding export

A made-up logistics company whose order application, `Quillmoor.Orders`, still runs on BizTalk Server. An
administrator exported its bindings to `Quillmoor.Orders.BindingInfo.xml`, and the file holds one thing of each kind
that a move to Azure must plan for:

- a FILE receive location with a custom flat file pipeline and a custom pipeline component, a second FILE receive
  location on the same address that was disabled and never removed, an FTP receive location, and a two-way
  WCF-BasicHttp receive location;
- a WCF-SQL send port whose transport settings hold a password typed back in by hand, and an FTP send port whose
  address holds a user name and a password; both are shown masked in every report;
- a FILE send port with a custom zip pipeline, a FILE send port with no filter that nothing is bound to (an orphan), a
  dynamic send port, a send port on a custom adapter (`Quillmoor.Telex`) with no mapped target, a WCF-NetTcp send port
  that `../config.json` maps, and an AS2 send port to a trading partner;
- one orchestration bound to three ports, and one party.

It also holds what must not be reported: the empty FTP passwords the export left, the built-in flat file
disassembler, the send ports that the orchestration names or that have a filter, and the public key tokens of the
assemblies.

```
node bin/biztalk-binding-inventory.js examples/messy --config examples/config.json
```

The folder is named, so the tool reads every file in it whose name ends in `.xml`; this README is left out and named in
a note.
