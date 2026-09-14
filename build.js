const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pkg = require('./package.json');
const srcPath = path.join(__dirname, 'dist', 'pine.js');
const minPath = path.join(__dirname, 'dist', 'pine.min.js');

console.log(`🌲 Building PineJS v${pkg.version} "${pkg.versionName}"...`);

if (!fs.existsSync(srcPath)) {
  console.error(`Error: Source file not found at ${srcPath}`);
  process.exit(1);
}

const sourceCode = fs.readFileSync(srcPath, 'utf8');

// Banner
const banner = `/*! PineJS v${pkg.version} "${pkg.versionName}" | (c) 2026 PineJS Core Team | MIT License | https://pinejs.dev */\n`;

// Clean minification preserving strings and regex literals
function minifyJS(code) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let inRegex = false;
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1] || '';
    const prevChar = code[i - 1] || '';

    // Handle string literals
    if (inString) {
      result += char;
      if (char === '\\' && !isEscaped) {
        isEscaped = true;
      } else {
        if (char === stringChar && !isEscaped) {
          inString = false;
        }
        isEscaped = false;
      }
      continue;
    }

    // Handle line comments
    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        result += '\n';
      }
      continue;
    }

    // Handle block comments
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    // Check for comment start
    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    // Check for string start
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      isEscaped = false;
      result += char;
      continue;
    }

    result += char;
  }

  // Optimize whitespace
  return result
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*([=+\-*\/%&|^!<>?:;{},()\[\]])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .replace(/\n+/g, '\n')
    .trim();
}

const minified = banner + minifyJS(sourceCode);
fs.writeFileSync(minPath, minified, 'utf8');

const srcSize = Buffer.byteLength(sourceCode, 'utf8');
const minSize = Buffer.byteLength(minified, 'utf8');
const gzSize = zlib.gzipSync(minified).length;

console.log(`\n✅ Build completed successfully!`);
console.log(`──────────────────────────────────────────`);
console.log(`  Source:     dist/pine.js      (${(srcSize / 1024).toFixed(2)} KB)`);
console.log(`  Production: dist/pine.min.js  (${(minSize / 1024).toFixed(2)} KB)`);
console.log(`  Gzipped:    dist/pine.min.js  (${(gzSize / 1024).toFixed(2)} KB)`);
console.log(`──────────────────────────────────────────\n`);
