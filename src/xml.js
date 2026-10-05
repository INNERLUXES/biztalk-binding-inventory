// A small XML reader for binding files, written for this tool so that no library decides what is read. It goes over the
// text once, left to right, with a stack and no recursion, and reads elements, attributes, text, CDATA sections,
// comments and processing instructions. It refuses, with the line and column:
//
//   - a DOCTYPE declaration, an ENTITY declaration or any other <! declaration: no document type definition is read,
//     so no external entity can be fetched (XXE) and no entity can expand into more text (the billion laughs);
//   - an entity reference other than the five XML predefines (&lt; &gt; &amp; &quot; &apos;) and character references;
//   - a character reference or a character that XML does not allow, such as a null or another control character;
//   - elements nested deeper than a limit, more elements, attributes or text than a limit, and a name that is too long;
//   - a tag that is not closed, an end tag that does not match, an attribute named twice, a second root element and
//     text outside the root element.
//
// Names are kept as written; a prefix such as xsi: is part of the name of an attribute, and the local name of an
// element is the part after its last colon. No namespace is looked up and nothing outside the text is read. The
// encoding named in an XML declaration is not used: the bytes were decoded before (src/files.js), from the byte order
// mark, and a text such as the filter of a send port, which BizTalk writes with a declaration that names UTF-16, is a
// string by the time it is read.

import { lineStarts, positionOf } from './json.js';
import { asciiLower } from './words.js';

export const XML_LIMITS = { maxDepth: 64, maxElements: 1000000, maxAttributes: 256, maxNameLength: 256, maxTextLength: 4194304 };

export class XmlError extends Error {
  constructor(reason, offset) {
    super(reason);
    this.reason = reason;
    this.offset = offset;
  }
}

const isSpace = (c) => c === 32 || c === 9 || c === 10 || c === 13;
const isNameStart = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 58 || c >= 0xc0;
const isNameChar = (c) => isNameStart(c) || (c >= 48 && c <= 57) || c === 45 || c === 46 || c === 0xb7 || c >= 0x80;

// The five entities XML predefines. No other entity is known, because no document type definition is read.
export const PREDEFINED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

// True for a code point XML allows in a document.
export const xmlChar = (cp) => cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff);

// The local name of an element or attribute: the part after the last colon.
export const localName = (name) => name.slice(name.lastIndexOf(':') + 1);

// Reads one XML text. Returns the root element: { name, local, attributes (a Map), children, text, offset, line,
// column }, where text is the text directly inside the element, with references replaced. Throws XmlError with the
// offset of the problem.
export function parseXml(text, limits = XML_LIMITS) {
  const lim = { ...XML_LIMITS, ...limits };
  const n = text.length;
  const fail = (reason, at) => {
    throw new XmlError(reason, at);
  };
  for (let k = 0; k < n; k += 1) {
    const c = text.charCodeAt(k);
    if ((c < 0x20 && c !== 9 && c !== 10 && c !== 13) || c === 0xfffe || c === 0xffff) fail(`a character XML does not allow (code ${c})`, k);
  }

  // The text of a run with its references replaced; at is the offset of the run, for the place of a problem.
  const decode = (raw, at) => {
    if (raw.indexOf('&') < 0) return raw;
    let out = '';
    let from = 0;
    for (;;) {
      const a = raw.indexOf('&', from);
      if (a < 0) return out + raw.slice(from);
      out += raw.slice(from, a);
      const b = raw.indexOf(';', a + 1);
      if (b < 0 || b - a > 34) fail('an & that does not start a reference; write it as &amp;', at + a);
      const ref = raw.slice(a + 1, b);
      if (ref[0] === '#') {
        let cp = NaN;
        if (/^#x[0-9a-fA-F]{1,6}$/.test(ref)) cp = parseInt(ref.slice(2), 16);
        else if (/^#[0-9]{1,7}$/.test(ref)) cp = parseInt(ref.slice(1), 10);
        if (!xmlChar(cp)) fail(`the character reference &${ref.slice(0, 12)}; names a character XML does not allow`, at + a);
        out += String.fromCodePoint(cp);
      } else if (Object.hasOwn(PREDEFINED, ref)) out += PREDEFINED[ref];
      else fail(`the entity reference &${ref.slice(0, 32)}; is not one XML predefines; the tool reads no document type definition, so it knows no other entity`, at + a);
      from = b + 1;
    }
  };

  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (text.startsWith('<?xml', i) && (i + 5 >= n || isSpace(text.charCodeAt(i + 5)) || text.startsWith('?>', i + 5))) {
    const e = text.indexOf('?>', i + 5);
    if (e < 0) fail('an XML declaration that is not closed with ?>', i);
    i = e + 2;
  }
  const stack = [];
  let current = null;
  let root = null;
  let elements = 0;
  const addText = (value, at) => {
    current.text += value;
    if (current.text.length > lim.maxTextLength) fail(`text longer than ${lim.maxTextLength.toLocaleString('en-US')} characters in one element`, at);
  };
  while (i < n) {
    const lt = text.indexOf('<', i);
    const end = lt < 0 ? n : lt;
    if (end > i) {
      if (current === null) {
        for (let k = i; k < end; k += 1) if (!isSpace(text.charCodeAt(k))) fail(root ? 'text after the root element' : 'text before the root element', k);
      } else addText(decode(text.slice(i, end), i), i);
      i = end;
      if (lt < 0) break;
    }
    if (text.startsWith('<!--', i)) {
      const e = text.indexOf('-->', i + 4);
      if (e < 0) fail('a comment that is not closed with -->', i);
      i = e + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', i)) {
      if (current === null) fail('a CDATA section outside the root element', i);
      const e = text.indexOf(']]>', i + 9);
      if (e < 0) fail('a CDATA section that is not closed with ]]>', i);
      addText(text.slice(i + 9, e), i);
      i = e + 3;
      continue;
    }
    if (text.startsWith('<!', i)) {
      let k = i + 2;
      while (k < n && k < i + 12 && isNameChar(text.charCodeAt(k))) k += 1;
      const word = text.slice(i + 2, k);
      if (word === 'DOCTYPE') fail('a DOCTYPE declaration; the tool reads no document type definition, which could declare external entities (XXE) or entities that expand without bound', i);
      if (word === 'ENTITY') fail('an ENTITY declaration; the tool reads no entity declarations (XXE, entity expansion)', i);
      fail('a declaration (<!) the tool does not read; only elements, text, CDATA, comments and processing instructions are read', i);
    }
    if (text.startsWith('<?', i)) {
      let k = i + 2;
      while (k < n && isNameChar(text.charCodeAt(k))) k += 1;
      if (asciiLower(text.slice(i + 2, k)) === 'xml') fail('an XML declaration that is not at the start of the text', i);
      const e = text.indexOf('?>', i + 2);
      if (e < 0) fail('a processing instruction that is not closed with ?>', i);
      i = e + 2;
      continue;
    }
    if (text.charCodeAt(i + 1) === 47) {
      let j = i + 2;
      while (j < n && isNameChar(text.charCodeAt(j))) j += 1;
      const name = text.slice(i + 2, j);
      while (j < n && isSpace(text.charCodeAt(j))) j += 1;
      if (text.charCodeAt(j) !== 62) fail('an end tag that is not closed with >', j);
      if (current === null) fail(`the end tag </${name.slice(0, 60)}> has no start tag`, i);
      if (name !== current.name) fail(`the end tag </${name.slice(0, 60)}> where </${current.name.slice(0, 60)}> was expected`, i);
      stack.pop();
      current = stack.length ? stack[stack.length - 1] : null;
      i = j + 1;
      continue;
    }
    const at = i;
    let j = i + 1;
    if (!isNameStart(text.charCodeAt(j))) fail('a < that does not start a tag; write it as &lt;', i);
    while (j < n && isNameChar(text.charCodeAt(j))) j += 1;
    const name = text.slice(i + 1, j);
    if (name.length > lim.maxNameLength) fail(`a name longer than ${lim.maxNameLength} characters`, i);
    if (current === null && root !== null) fail('a second root element; an XML text has one', i);
    elements += 1;
    if (elements > lim.maxElements) fail(`more than ${lim.maxElements.toLocaleString('en-US')} elements`, i);
    if (stack.length + 1 > lim.maxDepth) fail(`elements nested more than ${lim.maxDepth} deep`, i);
    const element = { name, local: localName(name), attributes: new Map(), children: [], text: '', offset: at, line: 0, column: 0 };
    let empty = false;
    for (;;) {
      const space = j;
      while (j < n && isSpace(text.charCodeAt(j))) j += 1;
      if (j >= n) fail(`the tag <${name.slice(0, 60)}> is not closed`, at);
      const c = text.charCodeAt(j);
      if (c === 62) {
        j += 1;
        break;
      }
      if (c === 47) {
        if (text.charCodeAt(j + 1) !== 62) fail('a / in a tag that is not followed by >', j);
        j += 2;
        empty = true;
        break;
      }
      if (j === space) fail('an attribute that is not separated by white space from what comes before it', j);
      if (!isNameStart(c)) fail('a character that does not start an attribute name', j);
      const nameAt = j;
      while (j < n && isNameChar(text.charCodeAt(j))) j += 1;
      const attribute = text.slice(nameAt, j);
      if (attribute.length > lim.maxNameLength) fail(`a name longer than ${lim.maxNameLength} characters`, nameAt);
      while (j < n && isSpace(text.charCodeAt(j))) j += 1;
      if (text.charCodeAt(j) !== 61) fail(`the attribute ${attribute.slice(0, 60)} has no = and no value`, j);
      j += 1;
      while (j < n && isSpace(text.charCodeAt(j))) j += 1;
      const q = text.charCodeAt(j);
      if (q !== 34 && q !== 39) fail(`the value of the attribute ${attribute.slice(0, 60)} is not in quotes`, j);
      const e = text.indexOf(q === 34 ? '"' : "'", j + 1);
      if (e < 0) fail(`the value of the attribute ${attribute.slice(0, 60)} is not closed`, j);
      const raw = text.slice(j + 1, e);
      const lessThan = raw.indexOf('<');
      if (lessThan >= 0) fail('a < inside an attribute value; write it as &lt;', j + 1 + lessThan);
      if (raw.length > lim.maxTextLength) fail(`an attribute value longer than ${lim.maxTextLength.toLocaleString('en-US')} characters`, j);
      if (element.attributes.has(attribute)) fail(`the attribute ${attribute.slice(0, 60)} appears twice in one tag`, nameAt);
      if (element.attributes.size >= lim.maxAttributes) fail(`more than ${lim.maxAttributes} attributes in one tag`, nameAt);
      // White space characters in an attribute value are read as spaces, as XML normalizes them.
      element.attributes.set(attribute, decode(raw.replace(/[\t\n\r]/g, ' '), j + 1));
      j = e + 1;
    }
    if (current) current.children.push(element);
    else root = element;
    if (!empty) {
      stack.push(element);
      current = element;
    }
    i = j;
  }
  if (root === null) fail('no root element; the text holds no XML element', n);
  if (current !== null) fail(`the element <${current.name.slice(0, 60)}> is not closed`, current.offset);
  const starts = lineStarts(text);
  const todo = [root];
  while (todo.length) {
    const e = todo.pop();
    const pos = positionOf(starts, e.offset);
    e.line = pos.line;
    e.column = pos.column;
    for (const c of e.children) todo.push(c);
  }
  return root;
}

// The reason of an XmlError with its line and column.
export function xmlProblem(error, text) {
  if (!(error instanceof XmlError)) return { line: 1, column: 1, text: error.message };
  const pos = positionOf(lineStarts(text), Math.min(error.offset, text.length));
  return { line: pos.line, column: pos.column, text: `line ${pos.line}, column ${pos.column}: ${error.reason}` };
}

// The first child element with this local name, or null.
export const childOf = (element, local) => (element ? element.children.find((c) => c.local === local) ?? null : null);

// Every child element with this local name.
export const childrenOf = (element, local) => (element ? element.children.filter((c) => c.local === local) : []);

// The trimmed text of the first child element with this local name, or an empty text.
export const textOf = (element, local) => {
  const c = childOf(element, local);
  return c ? c.text.trim() : '';
};

// The value of an attribute, trimmed, or an empty text.
export const attributeOf = (element, name) => (element && element.attributes.has(name) ? element.attributes.get(name).trim() : '');
