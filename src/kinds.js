// The kind of a file, from its name: a binding file is read when its name ends in .xml, compared without regard to the
// case of the letters A to Z. A file of no kind named on the command line stops the run, so a file is never passed over
// in silence; a file of no kind inside a folder that was named is left out and counted in a note.

import { asciiLower, baseName } from './words.js';

// The kinds the tool reads.
export const KINDS = ['xml'];

// The kind of a path, or null.
export function fileKind(path) {
  const name = asciiLower(baseName(path));
  if (name.endsWith('.xml') && name.length > 4) return 'xml';
  return null;
}
