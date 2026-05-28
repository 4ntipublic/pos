'use strict';

const escpos = require('escpos');
const EscposUsb = require('escpos-usb');

escpos.USB = EscposUsb;

const LINE_WIDTH = 42;
const STORE_NAME = process.env.PRINTER_STORE_NAME || 'TIENDA DEMO';
const STORE_RUT = process.env.PRINTER_STORE_RUT || 'RUT 76.000.000-0';
const STORE_TAGLINE = process.env.PRINTER_STORE_TAGLINE || 'VENTA LOCAL';

const formatMoney = (value) => {
  const amount = Math.round(Number(value) || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const clipText = (text, max) => {
  const value = String(text || '');
  if (value.length <= max) {
    return value;
  }
  return value.slice(0, Math.max(0, max - 1)) + '.';
};

const buildItemLine = (name, qty, price) => {
  const nameCol = 22;
  const qtyCol = 6;
  const priceCol = Math.max(10, LINE_WIDTH - nameCol - qtyCol);
  const safeName = clipText(name, nameCol).padEnd(nameCol, ' ');
  const safeQty = String(qty).padStart(qtyCol, ' ');
  const safePrice = formatMoney(price).padStart(priceCol, ' ');
  return `${safeName}${safeQty}${safePrice}`;
};

const buildTotalLine = (label, value) => {
  const left = `${label}:`;
  const right = formatMoney(value);
  const space = Math.max(1, LINE_WIDTH - left.length - right.length);
  return `${left}${' '.repeat(space)}${right}`;
};

const parseUsbId = (value) => {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const radix = text.toLowerCase().startsWith('0x') ? 16 : 10;
  const parsed = Number.parseInt(text, radix);
  return Number.isFinite(parsed) ? parsed : null;
};

const getUsbDevice = () => {
  const vendorId = parseUsbId(process.env.PRINTER_VENDOR_ID);
  const productId = parseUsbId(process.env.PRINTER_PRODUCT_ID);

  if (vendorId != null && productId != null) {
    return new escpos.USB(vendorId, productId);
  }

  if (typeof escpos.USB.findPrinter === 'function') {
    const devices = escpos.USB.findPrinter();
    if (Array.isArray(devices) && devices.length > 0) {
      const descriptor = devices[0].deviceDescriptor || devices[0];
      if (descriptor && descriptor.idVendor && descriptor.idProduct) {
        return new escpos.USB(descriptor.idVendor, descriptor.idProduct);
      }
    }
  }

  return new escpos.USB();
};

const normalizePrinterError = (err) => {
  const message = String(err && err.message ? err.message : 'Printer error');
  const code = err && (err.code || err.errno) ? String(err.code || err.errno) : '';
  const lower = message.toLowerCase();
  const lowerCode = code.toLowerCase();

  if (
    lower.includes('not found') ||
    lower.includes('no device') ||
    lowerCode.includes('not_found')
  ) {
    return 'Printer not detected';
  }

  if (
    lower.includes('busy') ||
    lower.includes('resource') ||
    lower.includes('claim') ||
    lowerCode.includes('busy')
  ) {
    return 'Printer is busy';
  }

  if (lower.includes('access') || lowerCode.includes('access')) {
    return 'USB access denied';
  }

  if (lower.includes('usb') || lowerCode.includes('usb')) {
    return 'USB communication failed';
  }

  return 'Printer communication failed';
};

const normalizeCartData = (cartData) => {
  if (!cartData || typeof cartData !== 'object') {
    return { ok: false, error: 'Invalid cart data' };
  }

  const rawItems = Array.isArray(cartData.items) ? cartData.items : [];
  if (rawItems.length === 0) {
    return { ok: false, error: 'Cart is empty' };
  }

  const items = rawItems.map((item) => {
    const nombre = String(item && item.nombre ? item.nombre : 'Producto');
    const cantidad = Math.max(1, Math.floor(toNumber(item && item.cantidad ? item.cantidad : 1)));
    const precio = toNumber(item && item.precio ? item.precio : 0);
    const subtotal = item && item.subtotal != null ? toNumber(item.subtotal) : cantidad * precio;

    return {
      nombre,
      cantidad,
      precio,
      subtotal,
    };
  });

  const subtotal =
    cartData.subtotal != null
      ? toNumber(cartData.subtotal)
      : items.reduce((sum, item) => sum + item.subtotal, 0);
  const iva = cartData.iva != null ? toNumber(cartData.iva) : subtotal * 0.19;
  const total = cartData.total != null ? toNumber(cartData.total) : subtotal + iva;

  return {
    ok: true,
    items,
    subtotal,
    iva,
    total,
  };
};

const openDevice = (device) => new Promise((resolve, reject) => {
  device.open((err) => {
    if (err) {
      reject(err);
      return;
    }
    resolve();
  });
});

const printReceiptBody = (printer, payload) => new Promise((resolve, reject) => {
  try {
    const divider = '-'.repeat(LINE_WIDTH);

    printer.align('CT');
    printer.style('B');
    printer.size(1, 1);
    printer.text(STORE_NAME);
    printer.size(0, 0);
    printer.style('NORMAL');
    printer.text(STORE_RUT);
    printer.text(STORE_TAGLINE);
    printer.text(divider);

    printer.align('LT');
    printer.text(buildItemLine('Producto', 'Cant', 'Precio'));
    printer.text(divider);

    payload.items.forEach((item) => {
      printer.text(buildItemLine(item.nombre, item.cantidad, item.precio));
    });

    printer.text(divider);
    printer.align('LT');
    printer.text(buildTotalLine('Subtotal', payload.subtotal));
    printer.text(buildTotalLine('IVA 19%', payload.iva));
    printer.text(buildTotalLine('Total', payload.total));

    printer.text(divider);
    printer.align('CT');
    printer.text('GRACIAS POR SU COMPRA');
    printer.text('VUELVA PRONTO');
    printer.feed(1);
    printer.cut();

    printer.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  } catch (err) {
    try {
      printer.close();
    } catch (closeErr) {
      console.error('[printer] close failed', closeErr);
    }
    reject(err);
  }
});

async function printReceipt(cartData) {
  let printer;

  try {
    const normalized = normalizeCartData(cartData);
    if (!normalized.ok) {
      return normalized;
    }

    let device;
    try {
      device = getUsbDevice();
    } catch (err) {
      return { ok: false, error: normalizePrinterError(err) };
    }

    printer = new escpos.Printer(device);
    await openDevice(device);
    await printReceiptBody(printer, normalized);

    return { ok: true };
  } catch (err) {
    console.error('[printer] print failed', err);
    return { ok: false, error: normalizePrinterError(err) };
  }
}

module.exports = {
  printReceipt,
};
