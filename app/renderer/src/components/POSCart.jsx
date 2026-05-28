import React from 'react';

const formatMoney = (value) => {
  const amount = Math.round(Number(value) || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function POSCart({ items, totals, onIncrement, onDecrement, onRemove }) {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Ticket</div>
          <h2 className="text-xl font-semibold text-slate-100">Carrito</h2>
        </div>
        <div className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
          {items.length} items
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            No hay productos en el carrito.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{item.nombre}</div>
                  <div className="text-xs text-slate-500">{formatMoney(item.precio)} unit.</div>
                </div>
                <div className="text-base font-semibold text-slate-100">
                  {formatMoney(item.subtotal)}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onDecrement(item.id)}
                    className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-100 transition hover:bg-slate-800 active:scale-[0.96]"
                  >
                    -
                  </button>
                  <div className="min-w-[44px] text-center text-lg font-semibold text-slate-100">
                    {item.cantidad}
                  </div>
                  <button
                    type="button"
                    onClick={() => onIncrement(item.id)}
                    className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 text-lg font-semibold text-slate-100 transition hover:bg-slate-800 active:scale-[0.96]"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 active:scale-[0.97]"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>Subtotal</span>
          <span className="font-semibold">{formatMoney(totals.subtotal)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
          <span>IVA 19%</span>
          <span className="font-semibold">{formatMoney(totals.iva)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xl font-semibold text-emerald-200">
          <span>Total</span>
          <span>{formatMoney(totals.total)}</span>
        </div>
      </div>
    </section>
  );
}
