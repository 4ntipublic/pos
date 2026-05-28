'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const TARGET = path.join(
  ROOT,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);
const PKG_PATH = path.join(ROOT, 'node_modules', 'better-sqlite3', 'package.json');

let ABI = process.env.ELECTRON_ABI;
const RUNTIME = (process.env.RUNTIME || 'electron').toLowerCase();
const PLATFORM = process.env.TARGET_PLATFORM || process.platform;
const ARCH = process.env.TARGET_ARCH || process.arch;
const FORCE = process.env.FORCE_DOWNLOAD === '1';

const log = (msg, meta) => {
  if (meta) {
    console.info(`[prebuild] ${msg}`, meta);
  } else {
    console.info(`[prebuild] ${msg}`);
  }
};

const fail = (msg, err) => {
  console.error(`[prebuild] ${msg}`, err || '');
  process.exitCode = 1;
  throw new Error(msg);
};

const requestJson = (url) =>
  new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'better-sqlite3-prebuild-fetch' } },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
  });

const downloadFile = (url, dest, redirectCount = 0) =>
  new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'better-sqlite3-prebuild-fetch',
            Accept: 'application/octet-stream',
          },
        },
        (res) => {
          const status = Number(res.statusCode || 0);

          if ([301, 302, 303, 307, 308].includes(status)) {
            const location = res.headers.location;
            res.resume();

            if (!location) {
              reject(new Error(`HTTP ${status} with no redirect location`));
              return;
            }

            if (redirectCount >= 5) {
              reject(new Error('Too many redirects'));
              return;
            }

            downloadFile(location, dest, redirectCount + 1).then(resolve).catch(reject);
            return;
          }

          if (status >= 400) {
            reject(new Error(`HTTP ${status}`));
            res.resume();
            return;
          }

          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => file.close(resolve));
        }
      )
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });

const listTarEntries = (archivePath) => {
  const result = spawnSync('tar', ['-tzf', archivePath], { encoding: 'utf8' });
  if (result.error) {
    fail('tar listing failed', result.error.message || result.error);
  }
  if (result.status !== 0) {
    fail('tar listing failed', result.stderr || result.stdout || `status ${result.status}`);
  }

  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const extractTarEntry = (archivePath, destDir, entry) => {
  const cleanEntry = String(entry || '').replace(/^\.\/+/, '');
  const result = spawnSync('tar', ['-xzf', archivePath, '-C', destDir, cleanEntry], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail('tar entry extraction failed', cleanEntry);
  }
  return cleanEntry;
};

const inspectArchive = (archivePath) => {
  try {
    const stat = fs.statSync(archivePath);
    const fd = fs.openSync(archivePath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
    log('archive info', { size: stat.size, isGzip });
    return { size: stat.size, isGzip };
  } catch (err) {
    console.error('[prebuild] archive inspection failed', err);
    return { size: 0, isGzip: false };
  }
};

const resolveAbiFromElectron = () => {
  const electronPath = process.platform === 'win32'
    ? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron');

  if (!fs.existsSync(electronPath)) {
    throw new Error('Electron binary not found');
  }

  const script = "console.log(JSON.stringify({ modules: process.versions.modules, electron: process.versions.electron }));";
  const result = spawnSync(electronPath, ['-e', script], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `Electron exited with ${result.status}`);
  }

  const output = String(result.stdout || '').trim();
  const parsed = JSON.parse(output);
  if (!parsed || !parsed.modules) {
    throw new Error('Electron ABI output not detected');
  }
  if (parsed.electron) {
    log('electron runtime version', { electron: parsed.electron, modules: parsed.modules });
  }
  return String(parsed.modules);
};

async function main() {
  try {
    if (!fs.existsSync(PKG_PATH)) {
      fail('better-sqlite3 is not installed in node_modules');
    }

    if (!ABI) {
      try {
        const electronPkg = require('electron/package.json');
        const version = electronPkg.version || '';
        ABI = resolveAbiFromElectron();
        log('resolved electron abi', { electron: version, abi: ABI });
      } catch (err) {
        console.error('[prebuild] abi resolution failed', err);
        fail('ELECTRON_ABI is not set and auto-detect failed');
      }
    }

    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    const version = pkg.version;
    const currentAbi = Number(process.versions.modules || 0);
    const targetAbi = Number(ABI);

    log('abi info', { currentAbi, targetAbi, runtime: RUNTIME, platform: PLATFORM, arch: ARCH });

    const binaryExists = fs.existsSync(TARGET);
    log('binary exists', { exists: binaryExists, target: TARGET });

    if (binaryExists && !FORCE && process.env.SKIP_IF_EXISTS === '1') {
      log('existing binary kept (SKIP_IF_EXISTS=1)');
      return;
    }

    const releaseUrl = `https://api.github.com/repos/WiseLibs/better-sqlite3/releases/tags/v${version}`;
    log('fetching release metadata', { releaseUrl });

    const release = await requestJson(releaseUrl);
    const needle = `${RUNTIME}-v${targetAbi}-${PLATFORM}-${ARCH}`;
    const asset =
      (release.assets || []).find((a) => a.name.includes(needle)) ||
      (release.assets || []).find((a) => a.name.includes(`${RUNTIME}-v${targetAbi}`));

    if (!asset) {
      const names = (release.assets || []).map((a) => a.name);
      fail(`no matching asset found for ${needle}`, names);
    }

    log('asset selected', { name: asset.name });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-sqlite3-'));
    const downloadPath = path.join(tmpDir, asset.name);

    await downloadFile(asset.browser_download_url, downloadPath);
    log('download complete', { downloadPath });

    const archiveInfo = inspectArchive(downloadPath);
    if (!archiveInfo.isGzip) {
      fail('downloaded file is not a gzip archive (possible redirect or HTML response)');
    }

    let extractedBinary = null;
    if (asset.name.endsWith('.node')) {
      extractedBinary = downloadPath;
    } else if (asset.name.endsWith('.tar.gz') || asset.name.endsWith('.tgz')) {
      const entries = listTarEntries(downloadPath);
      const nodeEntries = entries.filter((entry) => entry.toLowerCase().endsWith('.node'));

      if (nodeEntries.length === 0) {
        fail('no .node entry found in archive', entries.slice(0, 50));
      }

      log('node entries found', { count: nodeEntries.length, sample: nodeEntries.slice(0, 5) });
      const entryPath = extractTarEntry(downloadPath, tmpDir, nodeEntries[0]);
      extractedBinary = path.join(tmpDir, entryPath);
    } else {
      fail('unknown asset type; expected .tar.gz or .node');
    }

    if (!extractedBinary || !fs.existsSync(extractedBinary)) {
      fail('better_sqlite3.node not found in archive');
    }

    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.copyFileSync(extractedBinary, TARGET);
    log('binary installed', { target: TARGET });
  } catch (err) {
    console.error('[prebuild] failed', err);
    process.exitCode = 1;
  }
}

main();
