'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'pos.sqlite3');
const MAX_RETRIES = Number(process.env.DB_MAX_RETRIES || 5);
const BASE_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 200);

function sleepMs(ms) {
  if (ms <= 0) {
    return;
  }
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

function isBusyError(err) {
  if (!err) {
    return false;
  }
  const code = err.code || err.errno;
  const message = String(err.message || '').toLowerCase();
  return (
    code === 'SQLITE_BUSY' ||
    code === 'SQLITE_LOCKED' ||
    code === 'SQLITE_BUSY_TIMEOUT' ||
    message.includes('database is locked') ||
    message.includes('database busy')
  );
}

// Retry for transient locks to reduce user-facing errors.
function withRetry(action, label) {
  let attempt = 0;
  while (true) {
    try {
      return action();
    } catch (err) {
      attempt += 1;
      if (isBusyError(err) && attempt <= MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * BASE_DELAY_MS);
        const waitMs = delay + jitter;
        console.warn(`[db] ${label} busy/locked. Retrying ${attempt}/${MAX_RETRIES} in ${waitMs}ms`);
        sleepMs(waitMs);
        continue;
      }
      console.error(`[db] ${label} failed`, err);
      throw err;
    }
  }
}

let db;

try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
} catch (err) {
  console.error('[db] Failed to create database directory', err);
  throw err;
}

try {
  db = withRetry(() => new Database(DB_PATH), 'Open database');
} catch (err) {
  throw err;
}

try {
  withRetry(() => {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  }, 'Configure database');
} catch (err) {
  throw err;
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_barras TEXT,
  nombre TEXT NOT NULL,
  precio REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  categoria_id INTEGER,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  total REAL NOT NULL,
  estado TEXT NOT NULL,
  folio_sii TEXT
);

CREATE TABLE IF NOT EXISTS ventas_detalle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);
`;

try {
  withRetry(() => db.exec(schemaSql), 'Create schema');
} catch (err) {
  throw err;
}

module.exports = db;
