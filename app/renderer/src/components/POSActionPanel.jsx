import React, { useMemo, useState } from 'react';

const formatMoney = (value) => {
  const amount = Math.round(Number(value) || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function POSActionPanel({
  total,
  disabled,
  onCancel,
  onSuspend,
  onExact,
  onCharge,
}) {
  const [input, setInput] = useState('');

  const amount = useMemo(() => Number(input) || 0, [input]);

  const handleDigit = (value) => {
    setInput((prev) => `${prev}${value}`.slice(0, 10));
  };

  const handleBackspace = () => {
    setInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInput('');
  };

  const handleCharge = () => {
    try {
      onCharge({ amount, mode: 'manual' });
      setInput('');
    } catch (err) {
      console.error('[pos] charge action failed', err);
    }
  };

  const handleExact = () => {
    try {
      onExact();
      setInput('');
    } catch (err) {
      console.error('[pos] exact payment failed', err);
    }
  };

  const handleCancel = () => {
    try {
      onCancel();
      setInput('');
    } catch (err) {
      console.error('[pos] cancel failed', err);
    }
  };

  const handleSuspend = () => {
    try {
      onSuspend();
    } catch (err) {
      console.error('[pos] suspend failed', err);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Pago</div>
          <h3 className="text-lg font-semibold text-slate-100">Acciones</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-xl font-semibold text-emerald-200">{formatMoney(total)}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-right text-2xl font-semibold text-slate-100">
        {input ? formatMoney(amount) : 'Ingrese monto'}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(num)}
            className="h-16 rounded-2xl border border-slate-800 bg-slate-950/70 text-xl font-semibold text-slate-100 transition hover:bg-slate-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={handleClear}
          className="h-16 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpiar
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit(0)}
          className="h-16 rounded-2xl border border-slate-800 bg-slate-950/70 text-xl font-semibold text-slate-100 transition hover:bg-slate-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleBackspace}
          className="h-16 rounded-2xl border border-slate-800 bg-slate-950/70 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Borrar
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={handleCancel}
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar venta
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleSuspend}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Suspender
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleExact}
          className="rounded-2xl border border-slate-600/40 bg-slate-800/60 px-4 py-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Pago exacto
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleCharge}
          className="rounded-2xl border border-emerald-500/40 bg-emerald-500 px-4 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cobrar
        </button>
      </div>
    </section>
  );
}
