'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const db = require('./services/database');
const { printReceipt } = require('./services/printerService');
const { emitirBoletaElectronica } = require('./services/siiService');

function serializeError(err, fallbackCode) {
  const safeMessage = err && err.message ? String(err.message) : 'Unexpected error';
  const safeCode = err && err.code ? String(err.code) : String(fallbackCode || 'UNKNOWN');
  const safeName = err && err.name ? String(err.name) : 'Error';
  return {
    message: safeMessage,
    code: safeCode,
    name: safeName,
  };
}

function createWindow() {
  try {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: true,
      },
    });

    win.once('ready-to-show', () => {
      try {
        win.show();
      } catch (err) {
        console.error('[main] window show failed', err);
      }
    });

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    win
      .loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
      .catch((err) => {
        console.error('[main] loadFile failed', err);
      });
  } catch (err) {
    console.error('[main] createWindow failed', err);
  }
}

ipcMain.handle('db:getProducts', async () => {
  try {
    const stmt = db.prepare(
      'SELECT id, codigo_barras, nombre, precio, stock, categoria_id FROM productos'
    );
    const rows = stmt.all();
    return { ok: true, data: rows };
  } catch (err) {
    console.error('[ipc] db:getProducts failed', err);
    return { ok: false, error: serializeError(err, 'DB_GET_PRODUCTS_FAILED') };
  }
});

ipcMain.handle('hardware:printReceipt', async (_event, cartData) => {
  try {
    const result = await printReceipt(cartData);

    if (!result || typeof result.ok !== 'boolean') {
      return {
        ok: false,
        error: serializeError(new Error('Invalid printer response'), 'PRINT_RECEIPT_INVALID'),
      };
    }

    if (!result.ok) {
      return {
        ok: false,
        error: serializeError(new Error(result.error || 'Printer error'), 'PRINT_RECEIPT_FAILED'),
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('[ipc] hardware:printReceipt failed', err);
    return { ok: false, error: serializeError(err, 'PRINT_RECEIPT_FAILED') };
  }
});

ipcMain.handle('sii:emitirBoleta', async (_event, cartData, total) => {
  try {
    const result = await emitirBoletaElectronica(cartData, total);

    if (!result || typeof result.ok !== 'boolean') {
      console.error('[ipc] sii:emitirBoleta invalid response', result);
      return { ok: false, error: 'Respuesta invalida del servicio SII' };
    }

    if (!result.ok) {
      return { ok: false, error: String(result.error || 'Error al emitir boleta') };
    }

    return { ok: true, folio: result.folio };
  } catch (err) {
    console.error('[ipc] sii:emitirBoleta failed', err);
    return { ok: false, error: 'Error de conexion con el SII' };
  }
});

app.whenReady().then(() => {
  try {
    createWindow();
  } catch (err) {
    console.error('[main] app ready failed', err);
  }
});

app.on('activate', () => {
  try {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  } catch (err) {
    console.error('[main] activate failed', err);
  }
});

app.on('window-all-closed', () => {
  try {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  } catch (err) {
    console.error('[main] window-all-closed failed', err);
  }
});
