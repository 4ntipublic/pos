import React from 'react';

const navItems = [
  { key: 'pos', label: 'Punto de Venta' },
  { key: 'inventario', label: 'Inventario' },
];

export default function Layout({ children, active = 'inventario', onNavigate }) {
  const handleNavigate = (key) => {
    try {
      if (typeof onNavigate === 'function') {
        onNavigate(key);
      }
    } catch (err) {
      console.error('[ui] layout navigation failed', err);
    }
  };

  return (
    <div className="min-h-screen w-full font-['Space_Grotesk'] bg-[radial-gradient(circle_at_top_left,rgba(253,230,138,0.45),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_50%)]">
      <div className="min-h-screen w-full flex">
        <aside className="w-64 shrink-0 border-r border-slate-200/80 bg-slate-950 text-slate-100">
          <div className="px-6 py-6">
            <div className="text-xs tracking-[0.3em] uppercase text-emerald-300">ERP/POS</div>
            <div className="mt-2 text-2xl font-semibold leading-tight">Panel Central</div>
          </div>
          <nav className="px-3 py-2 space-y-2">
            {navItems.map((item) => {
              const isActive = item.key === active;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleNavigate(item.key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    isActive
                      ? 'bg-emerald-400/15 border-emerald-300 text-emerald-100'
                      : 'border-transparent text-slate-200 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <span className="block text-sm tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 px-8 py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
