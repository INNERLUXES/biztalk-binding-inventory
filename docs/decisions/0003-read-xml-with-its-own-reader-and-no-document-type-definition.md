# 3. Read XML with its own reader, and no document type definition

## Status

Accepted

## Context

A binding file is XML, and the inventory is meant to run on files from many hands: exports kept in repositories, files
edited by hand, files sent by another team. An XML reader that follows a document type definition can be made to read a
local file or fetch an address through an external entity (XXE), or to grow a few lines into gigabytes through nested
entities (the billion laughs). The OWASP cheat sheet on XXE advises turning document type definitions off entirely,
and refusing a DOCTYPE declaration where the reader can.

Node has no XML reader of its own, and this project takes no dependency. A binding file does not need a document type
definition: it holds elements, attributes, text and, in its transport, pipeline and filter settings, more XML written
as text.

## Decision

1. src/xml.js reads XML itself, once from left to right, with a stack and no recursion. It reads elements, attributes,
   text, CDATA sections, comments and processing instructions, and nothing else.
2. A DOCTYPE declaration, an ENTITY declaration and any other `<!` declaration are refused, and so is any entity
   reference but the five XML predefines; character references are read when XML allows the character. Nothing is
   fetched, no file other than the one named is opened, and no entity can expand.
3. The depth of elements, the number of elements and attributes, the length of a name and the length of a text are
   limited (docs/limits.md); the settings written as text are read with the same reader and the same limits, at most
   three levels deep.
4. A file the reader refuses is one `unparsable-file` finding at error, which cannot be lowered or set off, and nothing
   in it is checked. A file is read as UTF-8, or as UTF-16 after its byte order mark; the encoding named in an XML
   declaration is not used.

## Consequences

- No input can make the tool read another file, reach the network or use memory beyond the limits, and the tests feed
  it XXE, the billion laughs and long runs of brackets, quotes and references with a time check.
- The reader does not look up namespaces and does not validate against a schema; elements are read by their local
  names. A binding file is read as BizTalk Server writes it, which is enough for an inventory.
- A file with a DOCTYPE, even a harmless one, is refused; an export from BizTalk Server has none, so the fix is to
  export the bindings again.
