import React from 'react';

const NAV_ITEMS = [
  {
    key: 'pos',
    label: 'Ventas',
    description: 'POS y caja activa',
    badge: 'Live',
  },
  {
    key: 'inventario',
    label: 'Inventario',
    description: 'Gestion de productos',
    badge: 'CRUD',
  },
  {
    key: 'configuracion',
    label: 'Configuracion',
    description: 'Ticket y empresa',
    badge: 'Setup',
  },
];

export default function Sidebar({ active = 'pos', onNavigate }) {
  const handleNavigate = (key) => {
    try {
      if (typeof onNavigate === 'function') {
        onNavigate(key);
      }
    } catch (err) {
      console.error('[ui] sidebar navigate failed', err);
    }
  };

  return (
    <aside className="relative flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="px-6 pb-4 pt-6">
        <div className="text-xs uppercase tracking-[0.35em] text-emerald-300">ERP POS</div>
        <div className="mt-2 text-2xl font-semibold text-slate-100">Centro de Control</div>
        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-400">
          Modo Bestia activo. Operacion sin interrupciones.
        </div>
      </div>

      <nav className="flex-1 space-y-3 px-4 pb-6">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigate(item.key)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition active:scale-[0.98] ${
                isActive
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
                  : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.description}</div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em] ${
                    isActive
                      ? 'border-emerald-300/60 text-emerald-200'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-6 py-5 text-xs text-slate-500">
        <div className="uppercase tracking-[0.3em]">Estado</div>
        <div className="mt-2 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <span>Conexion local</span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-200">
            OK
          </span>
        </div>
      </div>
    </aside>
  );
}
