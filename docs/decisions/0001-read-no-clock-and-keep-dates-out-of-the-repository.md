# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A migration inventory is tempting to tie to the calendar: the end of support of the BizTalk Server release, the date a
binding file was exported (BizTalk writes one into the file), the age of a receive location that was disabled, a
migration wave that must finish before a contract ends. Each of these would make the same files give a different
result on a different day, so a pipeline that passed yesterday could fail today with no change to the repository, and
two people reading the same commit could see two inventories. The output could never be saved and compared.

The inventory does not need a date. Which adapter a port uses, whether it has a mapped target, whether a pipeline is
custom, whether a send port has a filter and whether a password is in the file can all be read from the files as they
are. When support ends is a fact of the lifecycle page, which changes; the tool points to it and does not repeat it.

## Decision

1. The tool reads no clock, no time zone and no locale. The same binding files and configuration give the same output
   on every machine and on every day.
2. A date in a binding file, such as the time stamp BizTalk Server writes on export, is not read, and no rule depends
   on one. The configuration has no key that holds a date.
3. No file of this repository holds a date or a number that reads like a year: not the licence, not the changelog, not
   the examples, not the documents, not the comments of the code. `npm run check` and a test fail on any number that
   reads like a year. Version numbers such as Node 22, RFC 4180 or 1.0.0 are not years and are fine; the years of
   product releases are left out, and so are web addresses that hold one, such as the lifecycle page of a BizTalk
   Server release.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it
  does not move with the calendar.
- The end of support of BizTalk Server is described in words and left to the migration overview on Microsoft Learn,
  which a reader checks for the current dates.
- The example binding files carry no time stamp, and their values are chosen so that no name, address or count reads
  like a year.
