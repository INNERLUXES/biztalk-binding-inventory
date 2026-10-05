# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "biztalk-binding-inventory security", or use private vulnerability
reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up binding file or configuration that shows the problem, the command you ran, what you expected
and what happened. Use made-up companies, applications and hosts, never the bindings of a real organisation, and never
a real key, token, password, host name or address, even an old one.

## Scope

In scope:

- an input that makes the tool read a file other than the binding files, the folders and the configuration it was
  given, follow a symbolic link, or resolve an external entity
- an input that makes the tool open a network connection, reach a host a binding file names, run a program or
  evaluate any part of a file
- an input that makes the tool write a file
- an input that makes the tool hang, take very long or use unbounded memory, such as entities that expand, a very
  large file, elements nested deep, very long values, or settings written as text inside settings
- a value of a setting named like a password, secret, key or token, a password of an address or a secret part of a
  connection string that reaches any output, a log or an error message unmasked
- binary or invalid input that the tool reads as if it were text
- an input that the tool fails to read and passes over without an error finding
- a run that passes at a `failOn` level although a file it read holds a finding at that level that docs/method.md says
  is reported
- text from a file or a file name that rewrites the terminal through control or direction characters, starts or ends
  a GitHub workflow command, is shown unescaped in the output, or starts a formula in the CSV inventory
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not read, a secret stored under a name the list does not
hold, whether a suggested target fits an application (the inventory is not a migration plan and not a certification),
who may change the binding files or the configuration in your repository, and where your pipeline keeps the output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
