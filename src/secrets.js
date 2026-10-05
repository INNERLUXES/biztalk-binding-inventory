// Credentials in a binding file, and how they are kept out of every report. BizTalk Server takes the passwords out of a
// binding file when it exports one, so a value found here was put back by hand, by a script or by an adapter that keeps
// it under another name. The tool reports where it is and never what it is: every value it finds is shown as MASK,
// whatever its length, and an address is masked before it is kept in the report.
//
// A name is read as the name of a secret in its field form (src/words.js): the letters A to Z lowered and everything
// else taken out. docs/method.md lists the parts of a name that make it one.

import { fieldForm } from './words.js';

// What a secret is shown as. The same text for every value, so its length is not shown either.
export const MASK = '****';

// A name holds one of these, or ends in one of SECRET_ENDINGS: the name of a secret.
export const SECRET_PARTS = ['password', 'passwd', 'pwd', 'passphrase', 'secret', 'token', 'credentialvalue'];
export const SECRET_ENDINGS = ['key', 'keyvalue', 'keydata'];
// A name that ends in one of these names a kind, a place or a switch, not the secret itself: SharedAccessKeyName,
// PasswordPolicy, TokenType, TokenProviderUri, UseTokenAuthentication.
export const NOT_SECRET_ENDINGS = ['name', 'type', 'uri', 'url', 'mode', 'provider', 'enabled', 'kind', 'id', 'policy', 'length', 'format', 'expiry', 'expiration', 'authentication', 'store'];
// Names that hold a secret part and are public: the public key token of an assembly.
export const NOT_SECRET_NAMES = ['publickeytoken', 'keytoken'];
// Parts of a connection string or of a query that hold a secret although their names do not say so.
export const SECRET_PAIRS = ['sig', 'sharedaccesssignature', 'pass'];

// True when a name is the name of a secret. extra holds more names, in their field form, from the configuration.
export function isSecretName(name, extra = []) {
  const f = fieldForm(name);
  if (f === '') return false;
  if (extra.includes(f)) return true;
  if (NOT_SECRET_NAMES.includes(f)) return false;
  if (NOT_SECRET_ENDINGS.some((e) => f.endsWith(e))) return false;
  return SECRET_PARTS.some((p) => f.includes(p)) || SECRET_ENDINGS.some((e) => f.endsWith(e));
}

// A text with every credential in it masked: the password of a user name and password before the host of an address
// (ftp://user:password@host) and the value of a name=value part whose name is that of a secret, in a connection
// string (Password=...;) or a query (?sig=...&code=...). Returns { text, found }, where found names each credential
// found, never its value. The text is read once, with no regular expression, so a long value costs one pass.
export function maskText(text, extra = []) {
  const found = [];
  const source = String(text);
  // The password of the user information of an address. The pieces are joined once at the end.
  const pieces = [];
  let kept = 0;
  let from = 0;
  for (;;) {
    const scheme = source.indexOf('://', from);
    if (scheme < 0) break;
    const start = scheme + 3;
    let end = start;
    let at = -1;
    let colon = -1;
    while (end < source.length && !'/?#\\ \t\r\n'.includes(source[end])) {
      if (source[end] === '@') at = end;
      else if (source[end] === ':' && colon < 0 && at < 0) colon = end;
      end += 1;
    }
    if (at >= start && colon >= 0 && colon < at && at > colon + 1) {
      pieces.push(source.slice(kept, colon + 1), MASK);
      kept = at;
      found.push('the password in the user information of an address');
    }
    from = end;
  }
  pieces.push(source.slice(kept));
  const out = pieces.join('');
  // The values of name=value parts with the name of a secret.
  let result = '';
  let i = 0;
  while (i < out.length) {
    let j = i;
    while (j < out.length && !';&?\r\n'.includes(out[j])) j += 1;
    const part = out.slice(i, j);
    const eq = part.indexOf('=');
    if (eq > 0) {
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (value !== '' && value !== MASK && name.length <= 64 && (isSecretName(name, extra) || SECRET_PAIRS.includes(fieldForm(name)))) {
        result += `${part.slice(0, eq + 1)}${MASK}`;
        found.push(`the value of ${name}`);
      } else result += part;
    } else result += part;
    if (j < out.length) result += out[j];
    i = j + 1;
  }
  return { text: result, found };
}
