'use strict';

const escpos = require('escpos');
const usb = require('usb');

const USB_PRINTER_CLASS = 0x07;
const LINE_WIDTH = 42;
const DEFAULT_STORE_NAME = process.env.PRINTER_STORE_NAME || 'TIENDA DEMO';
const DEFAULT_STORE_LEGAL =
  process.env.PRINTER_STORE_LEGAL || process.env.PRINTER_STORE_RUT || 'RUT 76.000.000-0';
const DEFAULT_STORE_ADDRESS =
  process.env.PRINTER_STORE_ADDRESS || process.env.PRINTER_STORE_TAGLINE || 'VENTA LOCAL';

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

const toHexId = (value) => `0x${Number(value).toString(16).padStart(4, '0')}`;

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

const deviceMatchesPrinterClass = (device) => {
  try {
    const config = device && device.configDescriptor;
    if (!config || !Array.isArray(config.interfaces)) {
      return false;
    }
    return config.interfaces.some((ifaceGroup) =>
      ifaceGroup.some((iface) => iface && iface.bInterfaceClass === USB_PRINTER_CLASS)
    );
  } catch (err) {
    console.error('[printer] usb interface check failed', err);
    return false;
  }
};

const selectUsbDevice = () => {
  const vendorId = parseUsbId(process.env.PRINTER_VENDOR_ID);
  const productId = parseUsbId(process.env.PRINTER_PRODUCT_ID);
  const devices = usb.getDeviceList();

  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error('USB device list is empty');
  }

  if (vendorId != null && productId != null) {
    const matched = devices.find(
      (device) =>
        device.deviceDescriptor &&
        device.deviceDescriptor.idVendor === vendorId &&
        device.deviceDescriptor.idProduct === productId
    );

    if (!matched) {
      throw new Error(`USB device not found for VID ${toHexId(vendorId)} PID ${toHexId(productId)}`);
    }

    return matched;
  }

  const printerDevice = devices.find(deviceMatchesPrinterClass);
  if (!printerDevice) {
    throw new Error('No USB printer-class device found');
  }

  return printerDevice;
};

const findPrinterInterface = (device) => {
  if (!device || !Array.isArray(device.interfaces)) {
    return null;
  }
  return (
    device.interfaces.find(
      (iface) => iface && iface.descriptor && iface.descriptor.bInterfaceClass === USB_PRINTER_CLASS
    ) || null
  );
};

const createUsbAdapter = (device) => {
  let iface = null;
  let endpoint = null;
  let isOpen = false;

  return {
    open(callback) {
      try {
        if (isOpen) {
          callback();
          return;
        }

        console.info('[printer] usb opening device');
        device.open();
        isOpen = true;

        iface = findPrinterInterface(device);
        if (!iface) {
          throw new Error('USB printer interface not found');
        }

        if (typeof iface.isKernelDriverActive === 'function' && iface.isKernelDriverActive()) {
          try {
            iface.detachKernelDriver();
            console.info('[printer] usb kernel driver detached');
          } catch (err) {
            console.error('[printer] usb detach kernel driver failed', err);
          }
        }

        try {
          iface.claim();
          console.info('[printer] usb interface claimed');
        } catch (err) {
          console.error('[printer] usb interface claim failed', err);
          throw err;
        }

        endpoint = iface.endpoints.find((ep) => ep && ep.direction === 'out');
        if (!endpoint) {
          throw new Error('USB OUT endpoint not found');
        }

        console.info('[printer] usb endpoint ready', { address: endpoint.address });
        callback();
      } catch (err) {
        console.error('[printer] usb open failed', err);
        callback(err);
      }
    },
    write(data, callback) {
      try {
        if (!endpoint) {
          throw new Error('USB endpoint not ready');
        }
        endpoint.transfer(data, (err) => {
          if (err) {
            console.error('[printer] usb write failed', err);
            callback(err);
            return;
          }
          callback();
        });
      } catch (err) {
        console.error('[printer] usb write exception', err);
        callback(err);
      }
    },
    close(callback) {
      try {
        if (!isOpen) {
          if (callback) {
            callback();
          }
          return;
        }

        const finishClose = (releaseErr) => {
          if (releaseErr) {
            console.error('[printer] usb interface release failed', releaseErr);
          }
          try {
            device.close();
            console.info('[printer] usb device closed');
          } catch (closeErr) {
            console.error('[printer] usb close failed', closeErr);
          }
          isOpen = false;
          if (callback) {
            callback();
          }
        };

        if (iface && typeof iface.release === 'function') {
          iface.release(true, finishClose);
          return;
        }

        finishClose();
      } catch (err) {
        console.error('[printer] usb close exception', err);
        if (callback) {
          callback(err);
        }
      }
    },
  };
};

const getUsbAdapter = () => {
  try {
    const device = selectUsbDevice();
    const descriptor = device.deviceDescriptor || {};
    console.info('[printer] usb device selected', {
      vendorId: descriptor.idVendor != null ? toHexId(descriptor.idVendor) : 'unknown',
      productId: descriptor.idProduct != null ? toHexId(descriptor.idProduct) : 'unknown',
    });
    return createUsbAdapter(device);
  } catch (err) {
    console.error('[printer] usb adapter selection failed', err);
    throw err;
  }
};

const normalizePrinterError = (err) => {
  const message = String(err && err.message ? err.message : 'Printer error');
  const code = err && (err.code || err.errno) ? String(err.code || err.errno) : '';
  const lower = message.toLowerCase();
  const lowerCode = code.toLowerCase();

  if (
    lower.includes('not found') ||
    lower.includes('no device') ||
    lowerCode.includes('not_found') ||
    lowerCode.includes('libusb_error_no_device')
  ) {
    return 'Printer not detected or disconnected';
  }

  if (
    lower.includes('busy') ||
    lower.includes('resource') ||
    lower.includes('claim') ||
    lowerCode.includes('busy') ||
    lowerCode.includes('libusb_error_busy')
  ) {
    return 'Printer is busy';
  }

  if (
    lower.includes('access') ||
    lowerCode.includes('access') ||
    lowerCode.includes('libusb_error_access')
  ) {
    return 'USB access denied';
  }

  if (
    lower.includes('timeout') ||
    lowerCode.includes('timeout') ||
    lowerCode.includes('libusb_error_timeout')
  ) {
    return 'USB timeout';
  }

  if (
    lower.includes('usb') ||
    lower.includes('transfer') ||
    lowerCode.includes('usb') ||
    lowerCode.includes('libusb_error_io') ||
    lowerCode.includes('libusb_error_pipe')
  ) {
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

const normalizeHeader = (config) => {
  const safe = config && typeof config === 'object' ? config : {};
  return {
    fantasyName: String(safe.fantasyName || DEFAULT_STORE_NAME).trim() || DEFAULT_STORE_NAME,
    legalName: String(safe.legalName || DEFAULT_STORE_LEGAL).trim() || DEFAULT_STORE_LEGAL,
    address: String(safe.address || DEFAULT_STORE_ADDRESS).trim() || DEFAULT_STORE_ADDRESS,
    logoPath: safe.logoPath ? String(safe.logoPath) : '',
  };
};

const loadLogoImage = (logoPath) =>
  new Promise((resolve) => {
    if (!logoPath) {
      resolve(null);
      return;
    }
    try {
      if (!escpos.Image || typeof escpos.Image.load !== 'function') {
        resolve(null);
        return;
      }
      escpos.Image.load(logoPath, (image) => {
        resolve(image || null);
      });
    } catch (err) {
      console.warn('[printer] logo load failed', err);
      resolve(null);
    }
  });

const printLogo = async (printer, logoPath) => {
  try {
    const image = await loadLogoImage(logoPath);
    if (!image) {
      return;
    }
    printer.align('CT');
    printer.image(image, 's8');
    printer.feed(1);
  } catch (err) {
    console.warn('[printer] logo print skipped', err);
  }
};

const openAdapter = (adapter) => new Promise((resolve, reject) => {
  adapter.open((err) => {
    if (err) {
      reject(err);
      return;
    }
    resolve();
  });
});

const closePrinter = (printer) =>
  new Promise((resolve, reject) => {
    printer.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

const printReceiptBody = async (printer, payload, header) => {
  try {
    const divider = '-'.repeat(LINE_WIDTH);

    await printLogo(printer, header.logoPath);

    printer.align('CT');
    printer.style('B');
    printer.size(1, 1);
    printer.text(header.fantasyName);
    printer.size(0, 0);
    printer.style('NORMAL');
    if (header.legalName) {
      printer.text(header.legalName);
    }
    if (header.address) {
      printer.text(header.address);
    }
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

    await closePrinter(printer);
  } catch (err) {
    try {
      printer.close();
    } catch (closeErr) {
      console.error('[printer] close failed', closeErr);
    }
    throw err;
  }
};

async function printReceipt(cartData, config) {
  let printer;

  try {
    const normalized = normalizeCartData(cartData);
    if (!normalized.ok) {
      return normalized;
    }
    const header = normalizeHeader(config);

    let adapter;
    try {
      adapter = getUsbAdapter();
    } catch (err) {
      return { ok: false, error: normalizePrinterError(err) };
    }

    printer = new escpos.Printer(adapter);
    await openAdapter(adapter);
    await printReceiptBody(printer, normalized, header);

    return { ok: true };
  } catch (err) {
    console.error('[printer] print failed', err);
    return { ok: false, error: normalizePrinterError(err) };
  }
}

module.exports = {
  printReceipt,
};
