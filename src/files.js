// Reading the binding files and the configuration. Only what is named on the command line is read: a file, or the
// files directly inside a folder whose names end in .xml. A folder is read one level deep and its subfolders are not
// walked. Each file is opened once with O_NOFOLLOW where the system has it, and its type and size are taken from the
// open handle, so a file swapped for a link, a pipe or a device after it was named is refused, and a file over its
// limit is refused before it is read. A path that is a symbolic link is refused, named on the command line or found in
// a folder. A file is read as UTF-8, with or without a byte order mark, or as UTF-16 when it starts with the byte order
// mark of UTF-16 (little or big endian), which is how BizTalk Server and many Windows tools save XML. Any other file
// that holds a null byte, or bytes that are not valid in their encoding, is refused as not text. The tool writes
// nothing to disk.

import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileKind } from './kinds.js';
import { byCode } from './words.js';

export const FILE_LIMITS = { maxConfigBytes: 1024 * 1024, maxFileBytes: 32 * 1024 * 1024, maxTotalBytes: 256 * 1024 * 1024, maxFolderFiles: 1000 };

// An error with the path in its message and the reason alone in .reason, so a caller can show its own path.
export function fileError(path, reason) {
  return Object.assign(new Error(`${path}: ${reason}`), { reason });
}

function megabytes(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString('en-US')} MB` : `${bytes.toLocaleString('en-US')} byte`;
}

// The flags a file is opened with: read only, and not through a symbolic link where the system can refuse one.
export const OPEN_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);

// The whole file, or an error when it is not a regular file or is over the limit.
export async function readBounded(path, maxBytes) {
  let handle;
  try {
    handle = await open(resolve(path), OPEN_FLAGS);
  } catch (error) {
    if (error.code === 'ENOENT') throw fileError(path, 'no such file');
    if (error.code === 'ELOOP' || error.code === 'EMLINK') throw fileError(path, 'is a symbolic link, which is not followed');
    if (error.code === 'EISDIR') throw fileError(path, 'is a folder');
    throw fileError(path, `cannot be read (${error.code ?? error.message})`);
  }
  try {
    const opened = await handle.stat();
    if (opened.isDirectory()) throw fileError(path, 'is a folder');
    if (!opened.isFile()) throw fileError(path, 'not a regular file');
    if (opened.size > maxBytes) throw fileError(path, `${opened.size.toLocaleString('en-US')} bytes is over the ${megabytes(maxBytes)} limit`);
    const buffer = Buffer.alloc(opened.size);
    let read = 0;
    while (read < opened.size) {
      const { bytesRead } = await handle.read(buffer, read, opened.size - read, read);
      if (bytesRead === 0) break;
      read += bytesRead;
    }
    return buffer.subarray(0, read);
  } finally {
    await handle.close();
  }
}

function toPosix(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

// A path as shown in a report: relative to the base folder with forward slashes; a path outside it is shown absolute,
// also with forward slashes.
export function displayPath(path, base) {
  const rel = relative(base, path);
  if (rel === '') return '.';
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return toPosix(path);
  return toPosix(rel);
}

// The encoding of a file from its first bytes: utf-16le or utf-16be after their byte order marks, else utf-8.
export function encodingOf(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
  return 'utf-8';
}

// The text of the bytes in an encoding, without a byte order mark, or null when the bytes are not valid in it or hold
// a null character. UTF-16 big endian is read by swapping each pair of bytes, so it needs no extra decoder.
export function decodeText(buffer, encoding = encodingOf(buffer)) {
  let bytes = buffer;
  if (encoding === 'utf-16be') {
    if (buffer.length % 2) return null;
    bytes = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i += 2) {
      bytes[i] = buffer[i + 1];
      bytes[i + 1] = buffer[i];
    }
  }
  let text;
  try {
    text = new TextDecoder(encoding === 'utf-8' ? 'utf-8' : 'utf-16le', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.includes(String.fromCharCode(0)) ? null : text;
}

// The text of a file, or an error whose .reason says why it is not read: missing, a link, a folder, not a regular file,
// over the limit, binary, or not valid UTF-8 or UTF-16. shown is the path the error names.
export async function readText(full, shown, maxBytes) {
  const buffer = await readBounded(full, maxBytes).catch((error) => {
    throw fileError(shown, error.reason ?? error.message);
  });
  const encoding = encodingOf(buffer);
  if (encoding === 'utf-8' && buffer.subarray(0, 8000).includes(0)) throw fileError(shown, 'holds binary data (a null byte); a UTF-16 file needs its byte order mark; export the bindings again');
  const text = decodeText(buffer, encoding);
  if (text === null) throw fileError(shown, `is not valid ${encoding === 'utf-8' ? 'UTF-8' : 'UTF-16'}; export the bindings again as UTF-8 or UTF-16 with a byte order mark`);
  return { size: buffer.length, encoding, text };
}

// What a path named on the command line is: { full, shown, folder }, or an error when it is missing, a symbolic link
// or not a regular file or folder. The path is looked at without following a link.
export async function inspectPath(path, base) {
  const full = resolve(base, path);
  const shown = displayPath(full, base);
  let info;
  try {
    info = await lstat(full);
  } catch (error) {
    if (error.code === 'ENOENT') throw fileError(shown, 'no such file or folder');
    throw fileError(shown, `cannot be read (${error.code ?? error.message})`);
  }
  if (info.isSymbolicLink()) throw fileError(shown, 'is a symbolic link, which is not followed; name the file or folder itself');
  if (info.isDirectory()) return { full, shown, folder: true };
  if (!info.isFile()) throw fileError(shown, 'is not a regular file or folder');
  return { full, shown, folder: false };
}

// The entries directly inside a folder: { files: [{ full, shown }] of the names that end in .xml, in the order of their
// names, links: the shown paths of symbolic links with such names, skipped: the names of other files, folders: the
// count of subfolders }. Nothing is followed and no subfolder is opened.
export async function listFolder(full, shown, limit = FILE_LIMITS.maxFolderFiles) {
  let entries;
  try {
    entries = await readdir(full, { withFileTypes: true });
  } catch (error) {
    throw fileError(shown, `cannot be read (${error.code ?? error.message})`);
  }
  const out = { files: [], links: [], skipped: [], folders: 0 };
  for (const e of entries.sort((a, b) => byCode(a.name, b.name))) {
    const path = shown === '.' ? e.name : `${shown}/${e.name}`;
    if (e.isDirectory()) out.folders += 1;
    else if (fileKind(e.name) === null) out.skipped.push(e.name);
    else if (e.isSymbolicLink()) out.links.push(path);
    else if (e.isFile()) out.files.push({ full: resolve(full, e.name), shown: path });
    else out.skipped.push(e.name);
  }
  if (out.files.length + out.links.length > limit) throw fileError(shown, `holds more than ${limit.toLocaleString('en-US')} files ending in .xml; name fewer folders or files`);
  return out;
}

// One file named on the command line, read as text: { file, full, size, text }.
export async function readTextFile(path, base, maxBytes) {
  const { full, shown, folder } = await inspectPath(path, base);
  if (folder) throw fileError(shown, 'is a folder; give the file itself');
  return { file: shown, full, ...(await readText(full, shown, maxBytes)) };
}
