# Threat model

## What the tool touches

- It reads the binding files and the folders named on the command line, one level deep, and the configuration file
  named with `--config`. Nothing else is opened.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, connects to none of the hosts the binding files name, follows no symbolic link,
  reads no document type definition, evaluates nothing it reads, starts no program and reads no clock.

## What the input may hold

Binding files come from BizTalk groups, from repositories and from other teams, and in a pipeline that checks every
pull request they may be written by whoever opened the pull request. Through them, a person can try to:

- make the tool read another file or reach the network: an external entity in a DOCTYPE (XXE), a file or folder named
  through a symbolic link, a link inside a folder, a file swapped for a link between the check and the read, a path
  written as a web address;
- exhaust the memory or the time: entities that expand into each other (the billion laughs), a file of megabytes, tens
  of thousands of ports, elements nested very deep, values of hundreds of thousands of characters for a pattern to
  read, settings written as text inside settings many times;
- leak a secret: a password in transport settings, an address or a connection string, which a report, a log, an
  annotation or a sheet would copy;
- move the result: a rule set to off, an adapter target or a built-in prefix that hides a finding, a `failOn` raised to
  `error`, a file left out of a run so a port looks fed;
- slip in something that is not text: a binary file renamed to `.xml`, bytes that are not valid in their encoding;
- rewrite the terminal or break the output: control characters, ANSI escapes, direction controls and line separators
  in a file name or in any value;
- start a second workflow command: a text that holds `::error`, `%`, a comma, a colon or a line break, which the GitHub
  format writes into a command;
- hide a formula in the CSV inventory: a name, an application, an adapter or an address that starts with `=`, `+`, `-`
  or `@`, which a spreadsheet may run when the inventory is opened;
- change how objects behave: a name, an adapter, an attribute or a configuration key named `__proto__`, `constructor`
  or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| An external entity reads a file or fetches an address (XXE) | The XML reader reads no document type definition: a DOCTYPE or ENTITY declaration and any entity but the five XML predefines are refused, as the OWASP cheat sheet advises. A test puts a system entity in a DOCTYPE |
| Entities expand without bound | No entity is declared, so none expands; the depth, the elements, the attributes and the text are limited. A test feeds the billion laughs |
| A symbolic link makes the tool read another file | A path named on the command line is looked at without following a link, and a link is refused; a link inside a folder is an `unreadable-file` finding; each file is opened with `O_NOFOLLOW` where the system has it and its type is taken from the open handle. Tests name a file, a folder and a configuration through links |
| The tool fetches, connects or runs something | No module of the network or of child processes is imported, nothing is evaluated, an address in a binding file is only text, and a path that looks like an address is refused. A test checks the imports of src |
| The memory or the time is exhausted | Files have size limits checked on the open handle before they are read, and a run has a limit on its bytes; the XML reader reads each character once with a stack and no recursion, and finds the end of a quoted value, a comment or a CDATA section with one search; settings inside settings are read three levels deep; the masking of secrets goes over a text once with no regular expression; artifacts are compared through maps, never pair by pair; findings are capped per rule. Tests check the time, with limits that widen under coverage only |
| A pattern from the input is slow | No regular expression is built from the input or the configuration; a test looks for `new RegExp` in src |
| A secret is copied into the output | An address is masked when it is read and the unmasked one is never kept; a filter value whose property is a secret is masked; a finding names a setting, never its value; the mask is the same for every value. A test writes passwords in attributes, elements, connection strings, addresses, filters and pipeline settings and looks for them in every format |
| The result is moved through the input or the configuration | A file, an artifact or settings that cannot be read are error findings that cannot be set off; a rule set to off is named in a note; an adapter with no entry is reported, never matched to a near name; files and subfolders left out of a folder are named in a note. Review a change to the configuration or the binding files like a change to code (docs/secure-defaults.md) |
| A binary file or bytes in another encoding are read as text | A null byte without a UTF-16 byte order mark, or bytes that are not valid UTF-8 or UTF-16, make the file an error finding; nothing in it is checked |
| Text from the input rewrites the terminal | Control characters are refused by the XML reader; every text, file names included, goes through `safeText`, which removes control, line separator and direction characters and caps the length. A test puts direction controls and line separators in a file name and in the values, in every format |
| A text starts a second workflow command | The GitHub format escapes `%`, CR and LF in a message and `:` and `,` in a property; a line break never reaches a command. A test writes `%0A::error::` and `::error file=` into a send port name |
| A formula runs when the CSV inventory is opened | A field that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a single quote in front. The OWASP page on CSV injection says no one escape is safe in every program, so treat an inventory built from files you do not trust as untrusted data, and open it with formulas off |
| `__proto__` changes how objects behave | Attributes are kept in maps, the targets of the configuration are defined as own properties and looked up in a map, and the configuration reader defines own properties. A test uses `__proto__`, `constructor` and `toString` as names, adapters, attributes and keys |
| A device or a pipe hangs the tool | A path that is not a regular file or folder is refused before it is read |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the binding files are the bindings that run, whether a suggested target fits an application, whether a secret
under a name that is not on the list is in a file (docs/limits.md), the assemblies, maps and schemas, who may change the
binding files or the configuration in your repository, and where your pipeline keeps the output.

The inventory is not a migration plan and not a certification.
