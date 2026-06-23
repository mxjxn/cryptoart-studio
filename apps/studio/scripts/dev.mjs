#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

function findNextBin(startDir) {
  let dir = startDir;
  while (true) {
    const candidate =
      process.platform === 'win32'
        ? join(dir, 'node_modules', '.bin', 'next.cmd')
        : join(dir, 'node_modules', '.bin', 'next');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const nextBin = findNextBin(appRoot);

if (!nextBin) {
  console.error('Could not find next binary. Run pnpm install from the monorepo root.');
  process.exit(1);
}

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
};

/** Light grey for box-drawing / vine characters */
const VINE_COLOR = '\x1b[38;5;252m';

/** Bright 256-color palette — random pick per █ cell */
const POP_COLORS = [
  196, 202, 208, 214, 220, 226, 46, 48, 51, 39, 45, 129, 135, 141, 147, 153, 159, 165,
  171, 177, 183, 189, 195, 201, 207, 213, 219, 82, 118, 154, 199, 208, 214, 33, 99, 165,
  200, 206, 212, 218, 224, 51, 87, 123, 159, 195, 49, 85, 121, 157, 193, 229, 42, 78, 114,
  150, 186, 222, 210, 216, 222, 228, 204, 210, 216, 222, 228, 234,
];

function randomPopColor() {
  const code = POP_COLORS[Math.floor(Math.random() * POP_COLORS.length)];
  return `\x1b[38;5;${code}m${c.bold}`;
}

function isVineChar(char) {
  return char !== '█' && char !== ' ' && char.charCodeAt(0) > 127;
}

function colorizeArtLine(line) {
  let out = '';
  for (const char of line) {
    if (char === ' ') {
      out += char;
    } else if (char === '█') {
      out += `${randomPopColor()}${char}${c.reset}`;
    } else if (isVineChar(char)) {
      out += `${VINE_COLOR}${char}${c.reset}`;
    } else {
      out += char;
    }
  }
  return out;
}

const GLYPHS = {
  S: [' ██████╗', '██╔════╝', '╚█████╗ ', ' ╚═══██╗', '███████╔╝', '╚══════╝'],
  T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
};

function composeWord(letters, gap = 1) {
  const spacer = ' '.repeat(gap);
  return Array.from({ length: 6 }, (_, row) =>
    letters.map((char) => GLYPHS[char][row]).join(spacer),
  );
}

function maxWidth(lines) {
  return Math.max(...lines.map((line) => line.length));
}

function centerLines(lines, targetWidth) {
  return lines.map((line) => {
    const pad = Math.max(0, Math.floor((targetWidth - line.length) / 2));
    return ' '.repeat(pad) + line;
  });
}

function buildBanner() {
  const cryptoart = [
    '   ██████╗██████╗ ██╗   ██╗██████╗ ████████╗ ██████╗  █████╗ ██████╗ ████████╗',
    '  ██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔══██╗╚══██╔══╝',
    '  ██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   ██║   ██║███████║██████╔╝   ██║   ',
    '  ██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██║   ██║██╔══██║██╔══██╗   ██║   ',
    '  ╚██████╗██║  ██║   ██║   ██║        ██║   ╚██████╔╝██║  ██║██║  ██║   ██║   ',
    '   ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ',
  ];

  const width = maxWidth(cryptoart);
  const studio = centerLines(composeWord(['S', 'T', 'U', 'D', 'I', 'O'], 1), width);
  const tagline = centerLines(['cryptoart.studio  →  localhost:3001'], width)[0];

  const lines = [
    '',
    ...cryptoart.map((line) => colorizeArtLine(line)),
    '',
    ...studio.map((line) => colorizeArtLine(line)),
    '',
    `${c.gray}${c.dim}${tagline}${c.reset}`,
    '',
  ];

  return lines.join('\n');
}

console.log(buildBanner());

const child = spawn(nextBin, ['dev', '--webpack', '-p', '3001'], {
  cwd: appRoot,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
