import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MASK, NOT_SECRET_ENDINGS, NOT_SECRET_NAMES, SECRET_ENDINGS, SECRET_PAIRS, SECRET_PARTS, isSecretName, maskText } from '../src/index.js';

// The names of secrets, and the masking of addresses and connection strings: every secret is shown as the same mask,
// and every name next to a secret that is not one is left alone.

test('secrets: the names of secrets, in any case and with any separators', () => {
  for (const name of ['Password', 'password', 'PWD', 'ProxyPassword', 'PrivateKeyPassword', 'Passphrase', 'IssuerSecret', 'ClientSecret', 'client_secret', 'AccessToken', 'SharedAccessKey', 'shared-access-key', 'AccountKey', 'ApiKey', 'api_key', 'SubscriptionKey', 'PrivateKey', 'Key', 'KeyValue', 'SigningKeyData', 'xsi:password']) assert.equal(isSecretName(name.replace(/^xsi:/, '')), true, name);
  assert.equal(SECRET_PARTS.includes('password'), true);
  assert.equal(SECRET_ENDINGS.includes('key'), true);
});

test('secrets: names next to a secret that are not secrets', () => {
  for (const name of ['UserName', 'SharedAccessKeyName', 'PublicKeyToken', 'TokenType', 'TokenProviderUri', 'PasswordPolicy', 'UseTokenAuthentication', 'KeyId', 'CredentialType', 'UseSasAuthentication', 'Keys', 'Monkeys', 'ServerAddress', 'Port', '', '--']) assert.equal(isSecretName(name), false, name);
  assert.ok(NOT_SECRET_NAMES.includes('publickeytoken'));
  assert.ok(NOT_SECRET_ENDINGS.includes('name'));
  assert.equal(isSecretName('PinCode'), false);
  assert.equal(isSecretName('Pin Code', ['pincode']), true, 'a name of the configuration is a secret');
  assert.equal(isSecretName('KeyName', ['keyname']), true, 'a name of the configuration wins over the endings that are not secrets');
});

test('secrets: the password of an address is masked, and the user name and host stay', () => {
  assert.deepEqual(maskText('ftp://qm:s3cret@ftp.x.test/in/'), { text: `ftp://qm:${MASK}@ftp.x.test/in/`, found: ['the password in the user information of an address'] });
  assert.equal(maskText('sftp://u:p:q@h:22/x').text, `sftp://u:${MASK}@h:22/x`, 'a colon in the password');
  assert.equal(maskText('https://u:p@a@h/x').text, `https://u:${MASK}@h/x`, 'an @ in the password');
  assert.equal(maskText('a ftp://u:p@h/ and ftp://v:q@g/').text, `a ftp://u:${MASK}@h/ and ftp://v:${MASK}@g/`);
  for (const plain of ['ftp://user@h/x', 'ftp://h:21/x', 'ftp://u:@h/', 'https://h/x?a=b@c', 'C:\\in\\*.xml', 'mssql://db//Warehouse?', 'net.tcp://h:8808/s', '://']) assert.deepEqual(maskText(plain), { text: plain, found: [] }, plain);
});

test('secrets: the secret parts of connection strings and queries are masked, and the others stay', () => {
  assert.deepEqual(maskText('Server=db;User Id=qm;Password=p@ss;Encrypt=True'), { text: `Server=db;User Id=qm;Password=${MASK};Encrypt=True`, found: ['the value of Password'] });
  assert.equal(maskText('Endpoint=sb://ns.test/;SharedAccessKeyName=send;SharedAccessKey=abc=').text, `Endpoint=sb://ns.test/;SharedAccessKeyName=send;SharedAccessKey=${MASK}`);
  assert.equal(maskText('https://h.test/api/x?code=abc&sig=xyz&sv=1').text, `https://h.test/api/x?code=abc&sig=${MASK}&sv=1`);
  assert.equal(maskText('DefaultEndpointsProtocol=https;AccountName=a;AccountKey=k==').text, `DefaultEndpointsProtocol=https;AccountName=a;AccountKey=${MASK}`);
  assert.equal(maskText('pwd = x ; uid=y').text, `pwd =${MASK}; uid=y`);
  assert.equal(maskText('Password=').found.length, 0, 'an empty value is no credential');
  assert.equal(maskText(`Password=${MASK}`).found.length, 0, 'a masked value is not found again');
  assert.equal(maskText('PinCode=1234', ['pincode']).text, `PinCode=${MASK}`);
  assert.equal(maskText(`${'n'.repeat(70)}Password=x`).found.length, 0, 'a name longer than 64 characters is not a name');
  assert.ok(SECRET_PAIRS.includes('sig'));
  for (const plain of ['Server=db;Database=w', 'BTS.MessageType=urn:x#Order', 'a=b&c=d', 'x', '']) assert.deepEqual(maskText(plain), { text: plain, found: [] }, plain);
});
