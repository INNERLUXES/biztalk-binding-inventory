# 2. Mask every credential, and never print a secret

## Status

Accepted

## Context

BizTalk Server takes the passwords out of a binding file when it exports one, and says that the file may still hold
sensitive data. In practice a binding file that is kept in a repository or passed around for a migration often holds a
secret anyway: an administrator types a password back into the transport settings so the import works, an address
carries a user name and a password (`ftp://user:password@host`), a connection string holds an account key, or a custom
adapter keeps its key under a name of its own. An inventory tool reads every one of these files, and its output goes to
terminals, pipeline logs, annotations on pull requests and sheets. A tool that printed an address as it found it would
copy the secret into all of them.

## Decision

1. Every address is masked when it is read, before it is kept: the password of the user information of an address and
   the value of a name=value part whose name is that of a secret (`Password=`, `AccountKey=`, `SharedAccessKey=`,
   `sig=` and the others of src/secrets.js) are replaced by `****`. The same mask is used for every value, so not even
   its length is shown. The unmasked address is never part of the report, in any format.
2. A value in an element or attribute whose name is that of a secret, anywhere in the file and in the transport,
   pipeline and filter settings written as text inside it, is a `plain-text-credential` finding at error. The finding
   names the setting and where it is, never the value.
3. The names of secrets are a documented list (docs/method.md) read in their field form, with endings that mark a name
   that is not a secret (`SharedAccessKeyName`, `PublicKeyToken`, `TokenType`). A team adds its own names with
   `secretNames` in the configuration; no key of the configuration can make a value shown.
4. A filter statement whose property is the name of a secret has its value masked too.

## Consequences

- An inventory can be posted to a pull request, kept as a pipeline artifact or opened in a sheet without spreading a
  password, and a test checks every format for the passwords of the examples.
- A finding says where to look, so the secret can be taken out of the file and rotated.
- The tool cannot tell whether a value is a real or a current secret, nor find one stored under a name that is not on
  the list; docs/limits.md says so. A false finding on a name that only looks like a secret is fixed by renaming the
  setting or by the endings of src/secrets.js, never by showing the value.
