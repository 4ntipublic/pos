import React, { useEffect, useRef } from 'react';

export default function POSProductGrid({
  products,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onAddProduct,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      try {
        onSearchSubmit(searchValue);
      } catch (err) {
        console.error('[pos] search submit failed', err);
      }
    }
  };

  return (
    <section className="flex flex-1 flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Busqueda rapida</div>
          <h2 className="text-2xl font-semibold text-slate-100">Productos</h2>
        </div>
        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          Escaner activo
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-5 py-4">
        <input
          ref={inputRef}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={handleSubmit}
          placeholder="Escanea o escribe codigo"
          className="w-full bg-transparent text-2xl font-semibold text-slate-100 outline-none placeholder:text-slate-500"
          inputMode="numeric"
        />
        <div className="mt-2 text-xs text-slate-500">Enter para agregar al carrito</div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              try {
                onAddProduct(item);
              } catch (err) {
                console.error('[pos] add quick product failed', err);
              }
            }}
            className="group flex h-24 flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-emerald-400/40 hover:bg-slate-900 active:scale-[0.98]"
          >
            <div className="text-sm font-semibold text-slate-100">{item.nombre}</div>
            <div className="text-xs text-slate-500">{item.codigo_barras || 'SKU rapido'}</div>
            <div className="text-lg font-semibold text-emerald-200">${item.precio}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
