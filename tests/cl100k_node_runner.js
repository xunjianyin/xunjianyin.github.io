/* Node runner for the cl100k tokenizer in easter/tokens.js (used by tests/test_cl100k_tokens.py).
 *
 * Usage: node tests/cl100k_node_runner.js < strings.json
 * Reads a JSON array of strings on stdin and prints {"parseMs": …, "ids": [[…], …]}: the token ids
 * the lens's own encoder produces for each string. The lens module runs unmodified in a vm
 * sandbox whose only global is a stub SiteLenses that captures the registered lens.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let lens = null;
const sandbox = {
  window: { SiteLenses: { register(registered) { lens = registered; } } },
  performance,
  TextDecoder,
  URL,
  console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'easter/tokens.js'), 'utf8'), sandbox, { filename: 'easter/tokens.js' });
if (!lens || !lens._tokenizer) throw new Error('easter/tokens.js did not register a lens with _tokenizer');

const { parseRanks, encode } = lens._tokenizer;
const began = performance.now();
const ranks = parseRanks(fs.readFileSync(path.join(ROOT, 'easter/cl100k.txt'), 'utf8'));
const parseMs = performance.now() - began;
const strings = JSON.parse(fs.readFileSync(0, 'utf8'));
const ids = strings.map(text => Array.from(encode(ranks, text), token => token.id));
process.stdout.write(JSON.stringify({ parseMs, ids }));
