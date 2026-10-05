import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { KINDS, adapterForm, asciiLower, baseName, byCode, capped, cleanTexts, decodeText, displayPath, encodingOf, fieldForm, fileError, fileKind, flat, grouped, inspectPath, lineStarts, listFolder, listText, plural, positionOf, readBounded, readText, readTextFile, safeText } from '../src/index.js';
import { withFiles } from './helpers.js';

// The small helpers: numbers and lists, text cleaning, words, kinds, lines and columns, and the files the tool reads.

test('size: grouped numbers, lists and plurals', () => {
  assert.equal(grouped(1234567), '1,234,567');
  assert.equal(listText([]), '');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd'], 2), 'a, b and 2 more');
  assert.equal(plural(1, 'port'), '1 port');
  assert.equal(plural(2, 'port'), '2 ports');
  assert.equal(plural(2, 'party', 'parties'), '2 parties');
});

test('text: control, line separator and direction characters become spaces; long text is cut; every text of a value is cleaned', () => {
  assert.equal(safeText(`a${String.fromCharCode(27)}b${String.fromCharCode(0x202e)}c${String.fromCharCode(0x2028)}d${String.fromCharCode(0x9b)}e`), 'a b c d e');
  assert.equal(safeText('x'.repeat(20), 10), 'xxxxxxx...');
  assert.equal(flat(' a \n\t b '), 'a b');
  assert.deepEqual(cleanTexts({ a: [`x${String.fromCharCode(7)}`], b: 1, c: null, d: true }), { a: ['x '], b: 1, c: null, d: true });
  assert.deepEqual(capped(Array.from({ length: 25 }, (_, i) => `p${i}`)).slice(-2), ['p19', 'and 5 more']);
  assert.deepEqual(capped(['a']), ['a']);
});

test('words: lowercase for A to Z only, the last part of a path, the forms of setting and adapter names, and code order', () => {
  assert.equal(asciiLower('ABC-xyz'), 'abc-xyz');
  assert.equal(asciiLower(`${String.fromCharCode(0x130)}I`), `${String.fromCharCode(0x130)}i`, 'no letter past ASCII changes, whatever the locale');
  assert.equal(baseName('a/b/orders.xml'), 'orders.xml');
  assert.equal(baseName('orders.xml'), 'orders.xml');
  assert.equal(fieldForm('Shared_Access-Key'), 'sharedaccesskey');
  assert.equal(fieldForm('sharedAccessKey'), 'sharedaccesskey');
  assert.equal(adapterForm(' WCF-SQL '), 'wcf-sql');
  assert.notEqual(adapterForm('WCF-SQL'), adapterForm('WCFSQL'));
  assert.deepEqual(['b', 'B', 'a'].sort(byCode), ['B', 'a', 'b']);
  assert.equal(byCode('a', 'a'), 0);
});

test('kinds: .xml in any case, and nothing else', () => {
  assert.deepEqual(KINDS, ['xml']);
  assert.equal(fileKind('a/orders.xml'), 'xml');
  assert.equal(fileKind('ORDERS.XML'), 'xml');
  assert.equal(fileKind('x/BindingInfo.Xml'), 'xml');
  for (const name of ['orders.txt', 'orders.xml.bak', 'xml', '.xml', 'a/b.xsd', 'a/b.msi', 'a/b.json']) assert.equal(fileKind(name), null, name);
});

test('lines: LF, CRLF and a lone CR each end a line; positions count from 1', () => {
  const starts = lineStarts('a\nb\r\nc\rd');
  assert.deepEqual(starts, [0, 2, 5, 7]);
  assert.deepEqual(positionOf(starts, 6), { line: 3, column: 2 });
});

test('files: UTF-8 with or without a byte order mark, UTF-16 little and big endian after their byte order marks, and nothing else', () => {
  const base = resolve('base');
  assert.equal(displayPath(resolve(base, 'a/b.xml'), base), 'a/b.xml');
  assert.equal(displayPath(base, base), '.');
  assert.ok(displayPath(resolve(base, '../x.xml'), base).endsWith('/x.xml'));
  assert.equal(fileError('a.xml', 'why').message, 'a.xml: why');
  assert.equal(fileError('a.xml', 'why').reason, 'why');
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<a/>', 'utf16le')]);
  const be = Buffer.from(le);
  for (let i = 0; i < be.length; i += 2) [be[i], be[i + 1]] = [le[i + 1], le[i]];
  assert.equal(encodingOf(le), 'utf-16le');
  assert.equal(encodingOf(be), 'utf-16be');
  assert.equal(encodingOf(Buffer.from('<a/>')), 'utf-8');
  assert.equal(decodeText(le), '<a/>');
  assert.equal(decodeText(be), '<a/>');
  assert.equal(decodeText(Buffer.from([0xef, 0xbb, 0xbf, 0x61])), 'a');
  assert.equal(decodeText(Buffer.from([0xc3])), null);
  assert.equal(decodeText(Buffer.from([0xfe, 0xff, 0x00])), null, 'an odd number of bytes is not UTF-16');
  assert.equal(decodeText(Buffer.from([0xff, 0xfe, 0x00, 0xd8])), null, 'a lone surrogate is not UTF-16');
  assert.equal(decodeText(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a\u0000b', 'utf16le')])), null, 'a null character is refused');
});

test('files: a file is read whole, and a missing file, a folder, binary data or one over its limit is refused', async () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<BindingInfo/>', 'utf16le')]);
  await withFiles({ 'a.xml': '<a/>\n', 'd/b.xml': '<b/>', 'w.xml': utf16, 'n.xml': Buffer.from([0x3c, 0, 0x61]), 'u.xml': Buffer.from([0x3c, 0xe9, 0x3e]) }, async (dir) => {
    assert.equal((await readBounded(resolve(dir, 'a.xml'), 100)).toString(), '<a/>\n');
    await assert.rejects(readBounded(resolve(dir, 'a.xml'), 2), /5 bytes is over the 2 byte limit/);
    await assert.rejects(readBounded(resolve(dir, 'nope.xml'), 100), /no such file/);
    await assert.rejects(readBounded(resolve(dir, 'd'), 100), /is a folder/);
    assert.deepEqual(await readText(resolve(dir, 'w.xml'), 'w.xml', 100), { size: utf16.length, encoding: 'utf-16le', text: '<BindingInfo/>' });
    await assert.rejects(readText(resolve(dir, 'n.xml'), 'n.xml', 100), /n\.xml: holds binary data \(a null byte\); a UTF-16 file needs its byte order mark/);
    await assert.rejects(readText(resolve(dir, 'u.xml'), 'u.xml', 100), /u\.xml: is not valid UTF-8/);
    const t = await readTextFile('a.xml', dir, 100);
    assert.deepEqual([t.file, t.text], ['a.xml', '<a/>\n']);
    assert.deepEqual(await inspectPath('a.xml', dir), { full: resolve(dir, 'a.xml'), shown: 'a.xml', folder: false });
    assert.equal((await inspectPath('d', dir)).folder, true);
    await assert.rejects(readTextFile('d', dir, 100), /d: is a folder; give the file itself/);
    await assert.rejects(inspectPath('nope.xml', dir), /nope\.xml: no such file or folder/);
  });
});

test('files: a folder gives its .xml files in the order of their names, one level deep, and counts the rest', async () => {
  await withFiles({ 'f/b.XML': '<b/>', 'f/a.xml': '<a/>', 'f/notes.txt': 'x', 'f/sub/c.xml': '<c/>' }, async (dir) => {
    const list = await listFolder(resolve(dir, 'f'), 'f');
    assert.deepEqual(list.files.map((f) => f.shown), ['f/a.xml', 'f/b.XML']);
    assert.deepEqual(list.skipped, ['notes.txt']);
    assert.equal(list.folders, 1);
    assert.deepEqual(list.links, []);
    await assert.rejects(listFolder(resolve(dir, 'f'), 'f', 1), /f: holds more than 1 files ending in \.xml/);
    await assert.rejects(listFolder(resolve(dir, 'nope'), 'nope'), /nope: cannot be read/);
    assert.deepEqual((await listFolder(resolve(dir, 'f'), '.')).files.map((f) => f.shown), ['a.xml', 'b.XML']);
  });
});
