/**
 * PineJS High-Performance Build & Minification Pipeline
 * Primary Engine: esbuild (AST optimization + mangling + compression)
 * Secondary Engine: terser (fallback)
 * Zero-Dep Engine: token-safe stream compressor (fallback)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pkg = require('./package.json');
const distDir = path.join(__dirname, 'dist');
const srcUmd = path.join(distDir, 'pine.js');
const minUmd = path.join(distDir, 'pine.min.js');
const srcEsm = path.join(distDir, 'pine.esm.js');
const minEsm = path.join(distDir, 'pine.esm.min.js');

const banner = `/*! PineJS v${pkg.version} "${pkg.versionName}" | (c) 2026 PineJS Core Team | MIT License | https://pinejs.dev */\n`;

// Color helpers for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m'
};

async function minifyCode(code, filename, targetEngine) {
  // 1. Try esbuild (fastest and most efficient)
  if (!targetEngine || targetEngine === 'esbuild') {
    try {
      const esbuild = require('esbuild');
      const result = await esbuild.transform(code, {
        minify: true,
        legalComments: 'none',
        target: 'es2020',
        format: filename.endsWith('.esm.js') || filename.endsWith('.esm.min.js') ? 'esm' : 'iife'
      });
      return { code: banner + result.code, engine: 'esbuild' };
    } catch (e) {
      if (targetEngine === 'esbuild') throw e;
    }
  }

  // 2. Try terser
  if (!targetEngine || targetEngine === 'terser') {
    try {
      const terser = require('terser');
      const result = await terser.minify(code, {
        module: filename.endsWith('.esm.js') || filename.endsWith('.esm.min.js'),
        compress: { passes: 2, drop_console: false },
        mangle: true,
        format: { comments: false }
      });
      return { code: banner + result.code, engine: 'terser' };
    } catch (e) {
      if (targetEngine === 'terser') throw e;
    }
  }

  // 3. Built-in zero-dependency tokenizer minifier (fallback)
  let result = '';
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1] || '';

    if (inString) {
      result += char;
      if (char === '\\' && !isEscaped) {
        isEscaped = true;
      } else {
        if (char === stringChar && !isEscaped) inString = false;
        isEscaped = false;
      }
      continue;
    }

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        result += '\n';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

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

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      isEscaped = false;
      result += char;
      continue;
    }

    result += char;
  }

  const cleaned = result
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*([=+\-*\/%&|^!<>?:;{},()\[\]])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .replace(/\n+/g, '\n')
    .trim();

  return { code: banner + cleaned, engine: 'built-in tokenizer' };
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

async function buildTarget(srcFile, destFile, label, engine) {
  if (!fs.existsSync(srcFile)) {
    console.error(`❌ Error: Source file not found at ${srcFile}`);
    return;
  }

  const startTime = Date.now();
  const rawCode = fs.readFileSync(srcFile, 'utf8');
  const { code: minCode, engine: usedEngine } = await minifyCode(rawCode, destFile, engine);

  fs.writeFileSync(destFile, minCode, 'utf8');

  const rawSize = Buffer.byteLength(rawCode, 'utf8');
  const minSize = Buffer.byteLength(minCode, 'utf8');
  const gzSize = zlib.gzipSync(minCode, { level: 9 }).length;
  const brSize = zlib.brotliCompressSync ? zlib.brotliCompressSync(minCode).length : null;
  const elapsed = Date.now() - startTime;
  const reduction = (((rawSize - minSize) / rawSize) * 100).toFixed(1);

  console.log(`\n📦 ${colors.bright}${label}${colors.reset} [${colors.green}${usedEngine}${colors.reset}] (${elapsed}ms)`);
  console.log(`   Source:     ${colors.dim}${path.relative(process.cwd(), srcFile)}${colors.reset} -> ${colors.bright}${formatSize(rawSize)}${colors.reset}`);
  console.log(`   Output:     ${colors.cyan}${path.relative(process.cwd(), destFile)}${colors.reset} -> ${colors.bright}${formatSize(minSize)}${colors.reset} (${reduction}% smaller)`);
  console.log(`   Gzipped:    ${colors.yellow}${formatSize(gzSize)}${colors.reset}`);
  if (brSize) {
    console.log(`   Brotli:     ${colors.magenta}${formatSize(brSize)}${colors.reset}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let engine = null;
  if (args.includes('--esbuild')) engine = 'esbuild';
  if (args.includes('--terser')) engine = 'terser';

  console.log(`\n🌲 ${colors.bright}PineJS v${pkg.version} "${pkg.versionName}" Multi-Target Build Pipeline${colors.reset}`);
  console.log(`────────────────────────────────────────────────────────────`);

  // 1. Generate Development Build (dist/pine.dev.js)
  const devBanner = `/**\n * PineJS v${pkg.version} "${pkg.versionName}" [DEVELOPMENT BUILD]\n * Full source with runtime diagnostics, DevTools bridge, and descriptive warnings.\n * For production deployments, use dist/pine.min.js or dist/pine.prod.js\n * (c) 2026 PineJS Core Team | MIT License | https://pinejs.dev\n */\n`;
  const rawUmd = fs.readFileSync(srcUmd, 'utf8');
  fs.writeFileSync(path.join(distDir, 'pine.dev.js'), devBanner + rawUmd.replace(/^\/\*\*[\s\S]*?\*\/\n/, ''), 'utf8');
  console.log(`\n🛠️  ${colors.bright}Development Bundle (IIFE)${colors.reset}`);
  console.log(`   Output:     ${colors.cyan}dist/pine.dev.js${colors.reset} -> ${colors.bright}${formatSize(Buffer.byteLength(rawUmd, 'utf8'))}${colors.reset}`);

  // 2. Generate Production Minified Builds (dist/pine.min.js and dist/pine.prod.js)
  await buildTarget(srcUmd, minUmd, 'Production Bundle (IIFE: pine.min.js)', engine);
  fs.copyFileSync(minUmd, path.join(distDir, 'pine.prod.js'));
  console.log(`   Mirrored:   ${colors.cyan}dist/pine.prod.js${colors.reset}`);

  // 3. Generate ES Module Builds
  fs.copyFileSync(srcEsm, path.join(distDir, 'pine.esm.dev.js'));
  await buildTarget(srcEsm, minEsm, 'Production ES Module Bundle (pine.esm.min.js)', engine);
  fs.copyFileSync(minEsm, path.join(distDir, 'pine.esm.prod.js'));
  console.log(`   Mirrored:   ${colors.cyan}dist/pine.esm.prod.js${colors.reset}`);

  console.log(`\n✨ ${colors.green}All Development and Production targets successfully generated!${colors.reset}\n`);
}

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
