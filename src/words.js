// Words compared as the tool compares them: the letters A to Z lowered whatever the locale. Used for the names of
// files, the names of adapters, pipelines and settings, and the suggestions of the configuration.

// Lowercase for the letters A to Z only, so the result does not depend on the locale.
export const asciiLower = (text) => String(text).replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

// The last part of a path with forward slashes: "a/b/orders.xml" is "orders.xml".
export const baseName = (path) => String(path).slice(String(path).lastIndexOf('/') + 1);

// The form the name of a setting is compared in: the letters A to Z lowered and everything that is not a letter A to Z
// or a digit taken out. "Shared_Access-Key", "sharedAccessKey" and "SharedAccessKey" are all "sharedaccesskey".
export const fieldForm = (text) => asciiLower(text).replace(/[^a-z0-9]+/g, '');

// The form the name of an adapter is compared in: trimmed, with the letters A to Z lowered. "WCF-SQL" and "wcf-sql "
// are one adapter; "WCF-SQL" and "WCFSQL" are two.
export const adapterForm = (text) => asciiLower(String(text).trim());

// Two texts in the order of their UTF-16 code units, with no locale.
export const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
