import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDEFINED, XML_LIMITS, XmlError, attributeOf, childOf, childrenOf, localName, parseXml, textOf, xmlChar, xmlProblem } from '../src/index.js';

const refused = (text, pattern, limits) => {
  assert.throws(() => parseXml(text, limits), (e) => e instanceof XmlError && pattern.test(e.reason), text.slice(0, 80));
};

test('xml: elements, attributes, text, CDATA, comments and processing instructions, with their lines and columns', () => {
  const text = '<?xml version="1.0" encoding="utf-16"?>\n<!-- head -->\n<a x="1" y=\'two\'>\n  <b:c>hi &amp; bye<![CDATA[<raw> & ]]></b:c>\n  <?pi data?>\n  <d/>\n</a>\n';
  const root = parseXml(text);
  assert.equal(root.name, 'a');
  assert.equal(root.line, 3);
  assert.equal(attributeOf(root, 'x'), '1');
  assert.equal(attributeOf(root, 'y'), 'two');
  assert.equal(attributeOf(root, 'z'), '');
  const c = childOf(root, 'c');
  assert.equal(c.name, 'b:c');
  assert.equal(c.text, 'hi & bye<raw> & ');
  assert.equal(c.line, 4);
  assert.equal(c.column, 3);
  assert.equal(childrenOf(root, 'd').length, 1);
  assert.equal(textOf(root, 'c'), 'hi & bye<raw> &');
  assert.equal(textOf(root, 'missing'), '');
  assert.equal(childOf(null, 'x'), null);
  assert.deepEqual(childrenOf(null, 'x'), []);
  assert.equal(localName('xsi:nil'), 'nil');
  assert.equal(localName('plain'), 'plain');
});

test('xml: the five predefined entities and character references are read, with white space in attributes read as spaces', () => {
  const root = parseXml('<a v="&lt;&gt;&amp;&quot;&apos;&#65;&#x42;&#x1F600;" w="a\tb\nc">&#9;x&#10;</a>');
  assert.equal(attributeOf(root, 'v'), `<>&"'AB${String.fromCodePoint(0x1f600)}`);
  assert.equal(root.attributes.get('w'), 'a b c');
  assert.equal(root.text, '\tx\n');
  assert.deepEqual(Object.keys(PREDEFINED), ['lt', 'gt', 'amp', 'quot', 'apos']);
  assert.ok(xmlChar(9) && xmlChar(0x20) && !xmlChar(0) && !xmlChar(0x1f) && !xmlChar(0xfffe) && !xmlChar(NaN));
});

test('xml: a DOCTYPE, an ENTITY or another declaration is refused, which stops XXE and entity expansion', () => {
  refused('<?xml version="1.0"?>\n<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>', /a DOCTYPE declaration; the tool reads no document type definition/);
  refused('<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><lolz>&lol2;</lolz>', /DOCTYPE/);
  refused('<a><!ENTITY x "y"></a>', /an ENTITY declaration/);
  refused('<a><!ELEMENT a ANY></a>', /a declaration \(<!\) the tool does not read/);
  refused('<a>&x;</a>', /the entity reference &x; is not one XML predefines/);
  refused('<a v="&ext;"/>', /the entity reference &ext;/);
  refused('<a>&#0;</a>', /names a character XML does not allow/);
  refused('<a>&#xD800;</a>', /names a character XML does not allow/);
  refused('<a>&#x110000;</a>', /names a character XML does not allow/);
  refused('<a>& b</a>', /an & that does not start a reference/);
  refused('<a>x\u0001</a>', /a character XML does not allow \(code 1\)/);
  // The same text with no declaration is read.
  assert.equal(parseXml('<lolz>lol</lolz>').text, 'lol');
});

test('xml: what is not well formed is refused with its place', () => {
  for (const [text, pattern] of [
    ['', /no root element/],
    ['   ', /no root element/],
    ['text', /text before the root element/],
    ['<a></a>x', /text after the root element/],
    ['<a></a><b/>', /a second root element/],
    ['<a>', /the element <a> is not closed/],
    ['<a><b></a>', /the end tag <\/a> where <\/b> was expected/],
    ['</a>', /the end tag <\/a> has no start tag/],
    ['<a></a', /an end tag that is not closed with >/],
    ['<a x="1" x="2"/>', /the attribute x appears twice/],
    ['<a x="1"y="2"/>', /not separated by white space/],
    ['<a x/>', /the attribute x has no = and no value/],
    ['<a x=1/>', /is not in quotes/],
    ['<a x="1/>', /is not closed/],
    ['<a x="<"/>', /a < inside an attribute value/],
    ['<a / >', /a \/ in a tag that is not followed by >/],
    ['<a', /the tag <a> is not closed/],
    ['<a><1/></a>', /a < that does not start a tag/],
    ['<a $="1"/>', /a character that does not start an attribute name/],
    ['<a><!-- x </a>', /a comment that is not closed/],
    ['<a><![CDATA[ x </a>', /a CDATA section that is not closed/],
    ['<![CDATA[x]]><a/>', /a CDATA section outside the root element/],
    ['<a><?pi x</a>', /a processing instruction that is not closed/],
    ['<a/><?xml version="1.0"?>', /an XML declaration that is not at the start/],
    ['<?xml version="1.0"', /an XML declaration that is not closed/]
  ]) refused(text, pattern);
  try {
    parseXml('<a>\n  <b>\n</a>');
  } catch (error) {
    assert.deepEqual(xmlProblem(error, '<a>\n  <b>\n</a>'), { line: 3, column: 1, text: 'line 3, column 1: the end tag </a> where </b> was expected' });
  }
  assert.deepEqual(xmlProblem(new Error('plain'), ''), { line: 1, column: 1, text: 'plain' });
});

test('xml: the limits of depth, elements, attributes, names and text hold', () => {
  assert.equal(XML_LIMITS.maxDepth, 64);
  refused(`${'<a>'.repeat(65)}${'</a>'.repeat(65)}`, /elements nested more than 64 deep/);
  assert.ok(parseXml(`${'<a>'.repeat(64)}${'</a>'.repeat(64)}`));
  refused('<a><b/><b/><b/></a>', /more than 3 elements/, { maxElements: 3 });
  refused('<a x="1" y="2" z="3"/>', /more than 2 attributes/, { maxAttributes: 2 });
  refused('<abcdef/>', /a name longer than 5 characters/, { maxNameLength: 5 });
  refused('<a abcdef="1"/>', /a name longer than 5 characters/, { maxNameLength: 5 });
  refused('<a>123456</a>', /text longer than 5 characters/, { maxTextLength: 5 });
  refused('<a v="123456"/>', /an attribute value longer than 5 characters/, { maxTextLength: 5 });
});

test('xml: a byte order mark and an XML declaration are skipped, and an XML declaration with no attributes is too', () => {
  assert.equal(parseXml(`${String.fromCharCode(0xfeff)}<?xml version="1.0"?><a/>`).name, 'a');
  assert.equal(parseXml('<?xml?><a/>').name, 'a');
  // A processing instruction whose name starts with xml but is longer is not a declaration.
  assert.equal(parseXml('<a><?xml-stylesheet href="x"?></a>').name, 'a');
});
