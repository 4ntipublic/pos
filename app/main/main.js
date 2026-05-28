'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { MAIN_WINDOW_WEBPACK_ENTRY, MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY } = require('./webpack.constants');
const db = require('./services/database');
const { printReceipt } = require('./services/printerService');
const { emitirBoletaElectronica } = require('./services/siiService');
const {
  loadReceiptConfig,
  saveReceiptConfig,
  selectReceiptLogo,
} = require('./services/settingsService');

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

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toInteger = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.trunc(num);
};

const sanitizeProductPayload = (payload) => {
  const codigo_barras = String(payload && payload.codigo_barras ? payload.codigo_barras : '').trim();
  const nombre = String(payload && payload.nombre ? payload.nombre : '').trim();
  const precio = toNumber(payload && payload.precio, 0);
  const stock = toInteger(payload && payload.stock, 0);
  const categoriaRaw = payload && payload.categoria_id != null ? Number(payload.categoria_id) : null;
  const categoria_id = Number.isFinite(categoriaRaw) ? categoriaRaw : null;

  if (!codigo_barras) {
    throw new Error('Codigo de barras obligatorio');
  }
  if (!nombre) {
    throw new Error('Nombre obligatorio');
  }
  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error('Precio invalido');
  }
  if (!Number.isFinite(stock) || stock < 0) {
    throw new Error('Stock invalido');
  }

  return {
    codigo_barras,
    nombre,
    precio,
    stock,
    categoria_id,
  };
};

const normalizeSalePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Datos de venta invalidos');
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (rawItems.length === 0) {
    throw new Error('Carrito vacio');
  }

  const items = rawItems.map((item, index) => {
    const nombre = String(item && item.nombre ? item.nombre : `Producto ${index + 1}`);
    const cantidad = Math.max(1, toInteger(item && item.cantidad, 1));
    const precio = toNumber(item && item.precio, 0);
    const subtotal = toNumber(item && item.subtotal, precio * cantidad);
    const codigo_barras = String(item && item.codigo_barras ? item.codigo_barras : '');
    const rawId = item && (item.producto_id != null ? item.producto_id : item.id);
    const id = Number.isFinite(Number(rawId)) ? Number(rawId) : null;

    return {
      id,
      codigo_barras,
      nombre,
      cantidad,
      precio,
      subtotal,
    };
  });

  const subtotal = toNumber(payload.subtotal, items.reduce((sum, item) => sum + item.subtotal, 0));
  const iva = toNumber(payload.iva, subtotal * 0.19);
  const total = toNumber(payload.total, subtotal + iva);

  return {
    items,
    subtotal,
    iva,
    total,
  };
};

const formatMoney = (value) => {
  const amount = Math.round(toNumber(value));
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

const writeReceiptSimulation = (payload, config) => {
  const baseDir = path.join(app.getPath('userData'), 'receipts');
  fs.mkdirSync(baseDir, { recursive: true });
  const filePath = path.join(baseDir, `receipt-${Date.now()}.txt`);

  const headerLines = [
    config && config.fantasyName ? config.fantasyName : 'TIENDA DEMO',
    config && config.legalName ? config.legalName : '',
    config && config.address ? config.address : '',
  ].filter(Boolean);

  const divider = '-'.repeat(42);
  const lines = [
    ...headerLines,
    divider,
    'Producto                  Cant  Precio',
    divider,
    ...payload.items.map(
      (item) =>
        `${String(item.nombre).slice(0, 22).padEnd(22)}${String(item.cantidad).padStart(6)}${
          formatMoney(item.precio).padStart(10)
        }`
    ),
    divider,
    `Subtotal:${formatMoney(payload.subtotal).padStart(31)}`,
    `IVA 19%:${formatMoney(payload.iva).padStart(31)}`,
    `Total:${formatMoney(payload.total).padStart(34)}`,
    divider,
    'GRACIAS POR SU COMPRA',
    'VUELVA PRONTO',
  ];

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return filePath;
};

function createWindow() {
  try {
    if (!MAIN_WINDOW_WEBPACK_ENTRY) {
      console.error('[main] webpack entry not available');
      return;
    }

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
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

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
      console.error('[main] renderer failed to load', {
        errorCode,
        errorDescription,
        url: validatedUrl,
      });
    });

    win.webContents.on('did-finish-load', () => {
      console.info('[main] renderer loaded', { url: win.webContents.getURL() });
    });

    win
      .loadURL(MAIN_WINDOW_WEBPACK_ENTRY)
      .catch((err) => {
        console.error('[main] loadURL failed', err);
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

ipcMain.handle('db:createProduct', async (_event, payload) => {
  try {
    const product = sanitizeProductPayload(payload);
    const stmt = db.prepare(
      'INSERT INTO productos (codigo_barras, nombre, precio, stock, categoria_id) VALUES (?, ?, ?, ?, ?)'
    );
    const info = stmt.run(
      product.codigo_barras,
      product.nombre,
      product.precio,
      product.stock,
      product.categoria_id
    );
    return { ok: true, id: info.lastInsertRowid };
  } catch (err) {
    console.error('[ipc] db:createProduct failed', err);
    return { ok: false, error: serializeError(err, 'DB_CREATE_PRODUCT_FAILED') };
  }
});

ipcMain.handle('db:updateProduct', async (_event, payload) => {
  try {
    if (!payload || payload.id == null) {
      throw new Error('ID requerido');
    }
    const product = sanitizeProductPayload(payload);
    const stmt = db.prepare(
      'UPDATE productos SET codigo_barras = ?, nombre = ?, precio = ?, stock = ?, categoria_id = ? WHERE id = ?'
    );
    const info = stmt.run(
      product.codigo_barras,
      product.nombre,
      product.precio,
      product.stock,
      product.categoria_id,
      payload.id
    );
    if (info.changes === 0) {
      throw new Error('Producto no encontrado');
    }
    return { ok: true };
  } catch (err) {
    console.error('[ipc] db:updateProduct failed', err);
    return { ok: false, error: serializeError(err, 'DB_UPDATE_PRODUCT_FAILED') };
  }
});

ipcMain.handle('db:deleteProduct', async (_event, id) => {
  try {
    if (id == null) {
      throw new Error('ID requerido');
    }
    const stmt = db.prepare('DELETE FROM productos WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) {
      throw new Error('Producto no encontrado');
    }
    return { ok: true };
  } catch (err) {
    console.error('[ipc] db:deleteProduct failed', err);
    return { ok: false, error: serializeError(err, 'DB_DELETE_PRODUCT_FAILED') };
  }
});

ipcMain.handle('sales:complete', async (_event, payload) => {
  try {
    const normalized = normalizeSalePayload(payload);
    const receiptConfig = loadReceiptConfig();

    const insertSale = db.prepare(
      'INSERT INTO ventas (fecha, total, estado, folio_sii) VALUES (?, ?, ?, ?)'
    );
    const insertDetail = db.prepare(
      'INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
    );
    const insertProduct = db.prepare(
      'INSERT INTO productos (codigo_barras, nombre, precio, stock, categoria_id) VALUES (?, ?, ?, ?, ?)'
    );
    const updateStock = db.prepare(
      'UPDATE productos SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END WHERE id = ?'
    );

    const createSale = db.transaction(() => {
      const now = new Date().toISOString();
      const saleInfo = insertSale.run(now, normalized.total, 'pagada', null);
      const saleId = Number(saleInfo.lastInsertRowid);

      normalized.items.forEach((item, index) => {
        let productId = item.id;
        if (!Number.isFinite(productId)) {
          const fallbackCode = item.codigo_barras || `AUTO-${Date.now()}-${index}`;
          const productInfo = insertProduct.run(
            fallbackCode,
            item.nombre,
            item.precio,
            0,
            null
          );
          productId = Number(productInfo.lastInsertRowid);
        }

        insertDetail.run(saleId, productId, item.cantidad, item.precio, item.subtotal);
        updateStock.run(item.cantidad, item.cantidad, productId);
      });

      return saleId;
    });

    const saleId = createSale();
    const printPayload = {
      items: normalized.items,
      subtotal: normalized.subtotal,
      iva: normalized.iva,
      total: normalized.total,
    };

    const printResult = await printReceipt(printPayload, receiptConfig);
    if (!printResult.ok) {
      const filePath = writeReceiptSimulation(printPayload, receiptConfig);
      return {
        ok: true,
        saleId,
        print: { ok: false, simulated: true, error: printResult.error, filePath },
      };
    }

    return { ok: true, saleId, print: { ok: true } };
  } catch (err) {
    console.error('[ipc] sales:complete failed', err);
    return { ok: false, error: serializeError(err, 'SALES_COMPLETE_FAILED') };
  }
});

ipcMain.handle('settings:getReceiptConfig', async () => {
  try {
    const config = loadReceiptConfig();
    return { ok: true, data: config };
  } catch (err) {
    console.error('[ipc] settings:getReceiptConfig failed', err);
    return { ok: false, error: serializeError(err, 'SETTINGS_GET_FAILED') };
  }
});

ipcMain.handle('settings:saveReceiptConfig', async (_event, payload) => {
  try {
    const config = saveReceiptConfig(payload);
    return { ok: true, data: config };
  } catch (err) {
    console.error('[ipc] settings:saveReceiptConfig failed', err);
    return { ok: false, error: serializeError(err, 'SETTINGS_SAVE_FAILED') };
  }
});

ipcMain.handle('settings:selectReceiptLogo', async () => {
  try {
    return await selectReceiptLogo();
  } catch (err) {
    console.error('[ipc] settings:selectReceiptLogo failed', err);
    return { ok: false, error: serializeError(err, 'SETTINGS_LOGO_FAILED') };
  }
});

ipcMain.handle('hardware:printReceipt', async (_event, cartData) => {
  try {
    const receiptConfig = loadReceiptConfig();
    const result = await printReceipt(cartData, receiptConfig);

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
