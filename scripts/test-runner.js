/**
 * PineJS Automated Headless Test Runner
 * Runs test-suite.html in headless Chrome or Edge without external npm dependencies.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PORT = 8899;
const ROOT_DIR = path.resolve(__dirname, '..');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function findBrowserBinary() {
  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    // Linux / Unix
    candidates.push('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser');
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Fallback: check PATH
  for (const cmd of ['chrome', 'google-chrome', 'msedge', 'chromium']) {
    try {
      const out = execSync(platform === 'win32' ? `where.exe ${cmd}` : `which ${cmd}`, { stdio: 'pipe' })
        .toString()
        .trim()
        .split(/\r?\n/)[0];
      if (out && fs.existsSync(out)) return out;
    } catch {}
  }

  return null;
}

async function run() {
  const browserPath = findBrowserBinary();
  if (!browserPath) {
    console.error('❌ Error: No Chrome or Edge browser found on this system.');
    process.exit(1);
  }

  console.log(`\n🌲 PineJS Automated Headless Test Runner`);
  console.log(`   Using browser: ${browserPath}`);

  let server;
  let browserProcess;
  let timer;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    if (browserProcess) {
      try {
        browserProcess.kill();
      } catch {}
    }
    if (server) {
      try {
        server.close();
      } catch {}
    }
  };

  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });

  const resultPromise = new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/results') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            resolve(data);
          } catch (e) {
            reject(e);
          }
        });
        return;
      }

      // Serve static files
      const safeUrl = req.url.split('?')[0];
      const filePath = path.join(ROOT_DIR, safeUrl === '/' ? 'tests/test-suite.html' : safeUrl);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found: ' + req.url);
        return;
      }

      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${PORT}/tests/test-suite.html?headless=true`;
      const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        url
      ];

      browserProcess = spawn(browserPath, args, { stdio: 'ignore' });

      browserProcess.on('error', (err) => {
        reject(new Error(`Failed to launch browser: ${err.message}`));
      });

      // 25 second timeout
      timer = setTimeout(() => {
        reject(new Error('Test run timed out after 25 seconds.'));
      }, 25000);
    });
  });

  try {
    const results = await resultPromise;
    cleanup();

    console.log(`\n────────────────────────────────────────────────────────────`);
    console.log(`   Suites Total:  ${results.suitesTotal}`);
    console.log(`   Suites Passed: ${results.suitesPassed}`);
    console.log(`   Suites Failed: ${results.suitesFailed}`);
    console.log(`   Tests Total:   ${results.testsTotal}`);
    console.log(`   Tests Passed:  ${results.testsPassed}`);
    console.log(`   Tests Failed:  ${results.testsFailed}`);
    console.log(`────────────────────────────────────────────────────────────`);

    if (results.failures && results.failures.length > 0) {
      console.log(`\n❌ Failed tests:`);
      results.failures.forEach((f) => console.log(`   - [${f.suite}] ${f.test}: ${f.error || 'Failed'}`));
      console.log(``);
      process.exit(1);
    } else {
      console.log(`\n✨ All test suites passed successfully! (100% pass rate)\n`);
      process.exit(0);
    }
  } catch (err) {
    cleanup();
    console.error(`\n❌ Test Runner Error:`, err.message);
    process.exit(1);
  }
}

run();
