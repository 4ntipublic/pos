import React, { useMemo, useState } from 'react';

const buildSampleCart = () => {
  const items = [
    { nombre: 'Producto demo', cantidad: 2, precio: 1500, subtotal: 3000 },
    { nombre: 'Cafe molido', cantidad: 1, precio: 4200, subtotal: 4200 },
  ];
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const iva = subtotal * 0.19;
  const total = subtotal + iva;

  return {
    items,
    subtotal,
    iva,
    total,
  };
};

export default function EmitirBoletaExample() {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const cartData = useMemo(() => buildSampleCart(), []);

  const handleEmit = async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      if (!window.api || typeof window.api.emitirBoleta !== 'function') {
        throw new Error('API no disponible');
      }

      const response = await window.api.emitirBoleta(cartData, cartData.total);

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        throw new Error(response.error || 'Error al emitir boleta');
      }

      console.info('[ui] boleta emitida', response);
      setStatus('success');
    } catch (err) {
      console.error('[ui] emitir boleta failed', err);
      setErrorMessage(err && err.message ? String(err.message) : 'Error inesperado');
      setStatus('error');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Emitir Boleta (Demo)</h2>
        <p className="text-sm text-slate-600">
          Ejemplo de consumo de window.api.emitirBoleta desde React.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleEmit}
        disabled={status === 'loading'}
        className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
          status === 'loading'
            ? 'cursor-not-allowed bg-slate-200 text-slate-600'
            : 'bg-emerald-600 text-white hover:bg-emerald-500'
        }`}
      >
        {status === 'loading' ? 'Procesando...' : 'Emitir boleta'}
      </button>

      {status === 'success' ? (
        <div className="text-sm text-emerald-600">Boleta emitida correctamente.</div>
      ) : null}
    </section>
  );
}
