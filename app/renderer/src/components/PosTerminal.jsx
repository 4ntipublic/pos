import React, { useMemo, useState } from 'react';

const formatMoney = (value) => {
  const rounded = Math.round(Number(value) || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(rounded);
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export default function PosTerminal({
  cart = [],
  onBoletaSuccess,
  showHeader = true,
  showItems = true,
  className = '',
}) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const items = useMemo(
    () =>
      cart.map((item, index) => {
        const cantidad = Math.max(1, Math.floor(toNumber(item && item.cantidad)) || 1);
        const precio = toNumber(item && item.precio);
        const subtotal =
          item && item.subtotal != null ? toNumber(item.subtotal) : cantidad * precio;

        return {
          id: item && item.id != null ? item.id : `${index}`,
          nombre: String(item && item.nombre ? item.nombre : `Producto ${index + 1}`),
          cantidad,
          precio,
          subtotal,
        };
      }),
    [cart]
  );

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const iva = subtotal * 0.19;
    const total = subtotal + iva;
    return { subtotal, iva, total };
  }, [items]);

  const payload = useMemo(
    () => ({
      items,
      subtotal: totals.subtotal,
      iva: totals.iva,
      total: totals.total,
    }),
    [items, totals]
  );

  const layoutClass = showItems
    ? 'mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]'
    : 'mt-5';

  const handleEmit = async () => {
    if (status === 'loading' || items.length === 0) {
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      if (!window.api || typeof window.api.emitirBoleta !== 'function') {
        throw new Error('API no disponible');
      }

      console.info('[pos] emitir boleta start', {
        items: items.length,
        total: totals.total,
      });

      const response = await window.api.emitirBoleta(payload, totals.total);

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        throw new Error(response.error || 'Error al emitir boleta');
      }

      console.info('[pos] emitir boleta ok', response);
      setStatus('success');
      setMessage(`Boleta emitida. Folio ${response.folio ?? 'N/A'}`);

      if (typeof onBoletaSuccess === 'function') {
        try {
          onBoletaSuccess(response);
        } catch (callbackErr) {
          console.error('[pos] onBoletaSuccess failed', callbackErr);
        }
      }
    } catch (err) {
      console.error('[pos] emitir boleta failed', err);
      setStatus('error');
      setMessage(err && err.message ? String(err.message) : 'Error inesperado');
    }
  };

  return (
    <section
      className={`w-full rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm ${className}`}
    >
      {showHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Terminal POS</div>
            <h2 className="text-2xl font-semibold text-slate-900">Resumen de carrito</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {items.length} items
          </div>
        </header>
      ) : null}

      {message ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            status === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className={layoutClass}>
        {showItems ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">
              Detalle de productos
            </div>
            <div className="max-h-64 space-y-3 overflow-auto pr-1">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  No hay productos en el carrito.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-white bg-white px-3 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.nombre}</div>
                      <div className="text-xs text-slate-500">
                        {item.cantidad} x {formatMoney(item.precio)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatMoney(item.subtotal)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">
            Resumen financiero
          </div>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Subtotal (Neto)</span>
              <span className="font-semibold">{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>IVA 19%</span>
              <span className="font-semibold">{formatMoney(totals.iva)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-semibold text-slate-900">
              <span>Total a pagar</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEmit}
            disabled={status === 'loading' || items.length === 0}
            className={`mt-6 w-full rounded-2xl px-5 py-5 text-lg font-semibold shadow-lg transition ${
              status === 'loading' || items.length === 0
                ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {status === 'loading' ? 'Procesando...' : 'Emitir Boleta'}
          </button>
        </div>
      </div>
    </section>
  );
}
