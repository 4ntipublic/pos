'use strict';

const DEFAULT_EMISOR = {
  rut: '76000000-0',
  razonSocial: 'TIENDA DEMO',
  giro: 'VENTA RETAIL',
  direccion: 'SANTIAGO',
  comuna: 'SANTIAGO',
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeItems = (cartData) => {
  const rawItems = Array.isArray(cartData && cartData.items) ? cartData.items : [];
  return rawItems.map((item, index) => {
    const cantidad = Math.max(1, Math.floor(toNumber(item && item.cantidad)) || 1);
    const precio = toNumber(item && item.precio);
    const subtotal =
      item && item.subtotal != null ? toNumber(item.subtotal) : cantidad * precio;

    return {
      n: index + 1,
      descripcion: String(item && item.nombre ? item.nombre : 'Producto'),
      cantidad,
      precioUnitario: precio,
      subtotal,
    };
  });
};

const buildBoletaPayload = (cartData, total) => {
  const items = normalizeItems(cartData);
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const iva = cartData && cartData.iva != null ? toNumber(cartData.iva) : subtotal * 0.19;
  const totalFinal = total != null ? toNumber(total) : subtotal + iva;

  return {
    documento: {
      tipo: 'BOLETA_ELECTRONICA',
      codigoSii: 39,
      encabezado: {
        emisor: DEFAULT_EMISOR,
        fechaEmision: new Date().toISOString(),
        moneda: 'CLP',
        totales: {
          neto: subtotal,
          iva,
          total: totalFinal,
        },
      },
      detalle: items,
    },
  };
};

const simulateSiiRequest = (payload, shouldFail) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!payload || shouldFail) {
        reject(new Error('SII_CONNECTION_FAILED'));
        return;
      }
      resolve();
    }, 600);
  });

async function emitirBoletaElectronica(cartData, total) {
  const payload = buildBoletaPayload(cartData, total);

  try {
    console.info('[sii] emitirBoletaElectronica start');
    await simulateSiiRequest(payload, cartData && cartData.forceFail === true);
    console.info('[sii] emitirBoletaElectronica ok', { folio: 12345 });
    return { ok: true, folio: 12345 };
  } catch (err) {
    console.error('[sii] emitirBoletaElectronica failed', err);
    return { ok: false, error: 'Error de conexion con el SII' };
  }
}

module.exports = {
  emitirBoletaElectronica,
};
