import React, { useEffect, useMemo, useRef, useState } from 'react';
import PosTerminal from '../components/PosTerminal';

const CATALOG = [
  { id: 101, codigo_barras: '780000111001', nombre: 'Agua 500ml', precio: 900 },
  { id: 102, codigo_barras: '780000111002', nombre: 'Cafe 250g', precio: 4200 },
  { id: 103, codigo_barras: '780000111003', nombre: 'Pan molde', precio: 3200 },
  { id: 104, codigo_barras: '780000111004', nombre: 'Leche entera 1L', precio: 1300 },
  { id: 105, codigo_barras: '780000111005', nombre: 'Galletas 200g', precio: 1800 },
  { id: 106, codigo_barras: '780000111006', nombre: 'Chocolate barra', precio: 1500 },
];

const formatMoney = (value) => {
  const rounded = Math.round(value);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(rounded);
};

export default function POS() {
  const [cart, setCart] = useState([]);
  const [scanCode, setScanCode] = useState('');
  const [inventory, setInventory] = useState([]);
  const inputRef = useRef(null);

  const catalogItems = useMemo(
    () => (inventory.length > 0 ? inventory : CATALOG),
    [inventory]
  );

  const refreshInventory = async (reason) => {
    try {
      if (!window.api || typeof window.api.getProducts !== 'function') {
        throw new Error('API no disponible');
      }

      console.info('[pos] refreshInventory start', { reason });
      const response = await window.api.getProducts();

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        const message = response.error && response.error.message
          ? String(response.error.message)
          : 'Error al cargar inventario';
        throw new Error(message);
      }

      const rows = Array.isArray(response.data) ? response.data : [];
      const mapped = rows.map((item, index) => ({
        id: item && item.id != null ? item.id : `db-${index}`,
        codigo_barras: item && item.codigo_barras ? String(item.codigo_barras) : '',
        nombre: String(item && item.nombre ? item.nombre : `Producto ${index + 1}`),
        precio: Number(item && item.precio) || 0,
      }));

      setInventory(mapped);
      console.info('[pos] refreshInventory ok', { count: mapped.length });
    } catch (err) {
      console.error('[pos] refreshInventory failed', err);
    }
  };

  useEffect(() => {
    refreshInventory('init');
  }, []);

  const upsertProduct = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (!existing) {
        const initial = {
          ...product,
          cantidad: 1,
          subtotal: product.precio,
        };
        return [...prev, initial];
      }
      return prev.map((item) => {
        if (item.id !== product.id) {
          return item;
        }
        const cantidad = item.cantidad + 1;
        return {
          ...item,
          cantidad,
          subtotal: cantidad * item.precio,
        };
      });
    });
  };

  const findProduct = (code) => {
    const normalized = code.trim();
    if (!normalized) {
      return null;
    }

    const byBarcode = catalogItems.find(
      (item) => String(item && item.codigo_barras ? item.codigo_barras : '') === normalized
    );
    if (byBarcode) {
      return byBarcode;
    }

    const byName = catalogItems.find(
      (item) => String(item && item.nombre ? item.nombre : '').toLowerCase() ===
        normalized.toLowerCase()
    );
    if (byName) {
      return byName;
    }

    return {
      id: Date.now(),
      codigo_barras: normalized,
      nombre: `Producto ${normalized}`,
      precio: 1200,
    };
  };

  const handleScanEnter = () => {
    try {
      const product = findProduct(scanCode);
      if (!product) {
        return;
      }
      upsertProduct(product);
      setScanCode('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err) {
      console.error('[pos] handleScanEnter failed', err);
    }
  };

  const handleScanKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleScanEnter();
    }
  };

  const incrementItem = (id) => {
    try {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== id) {
            return item;
          }
          const cantidad = item.cantidad + 1;
          return { ...item, cantidad, subtotal: cantidad * item.precio };
        })
      );
    } catch (err) {
      console.error('[pos] incrementItem failed', err);
    }
  };

  const decrementItem = (id) => {
    try {
      setCart((prev) => {
        const next = prev
          .map((item) => {
            if (item.id !== id) {
              return item;
            }
            const cantidad = item.cantidad - 1;
            if (cantidad <= 0) {
              return null;
            }
            return { ...item, cantidad, subtotal: cantidad * item.precio };
          })
          .filter(Boolean);
        return next;
      });
    } catch (err) {
      console.error('[pos] decrementItem failed', err);
    }
  };

  const removeItem = (id) => {
    try {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('[pos] removeItem failed', err);
    }
  };

  const handleBoletaSuccess = (result) => {
    try {
      console.info('[pos] boleta success received', result);
      setCart([]);
      setScanCode('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
      refreshInventory('boleta');
    } catch (err) {
      console.error('[pos] handleBoletaSuccess failed', err);
    }
  };

  return (
    <div
      className="min-h-screen w-full font-['Space_Grotesk'] text-slate-900 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.28),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_60%)]"
      style={{
        '--accent': '#f97316',
        '--accent-soft': 'rgba(249,115,22,0.18)',
        '--ticket': '#0b1220',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 flex flex-col gap-2">
          <div className="text-xs uppercase tracking-[0.4em] text-slate-600">
            Punto de Venta
          </div>
          <h1 className="text-3xl font-semibold">Venta rapida</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Buscar productos</h2>
                <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                  Escaneo activo
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <input
                  ref={inputRef}
                  autoFocus
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value)}
                  onKeyDown={handleScanKeyDown}
                  placeholder="Escanea o escribe un codigo"
                  className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  inputMode="numeric"
                />
                <div className="mt-2 text-xs text-slate-500">
                  Presiona Enter para agregar al carrito.
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">
                  Productos frecuentes
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {catalogItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => upsertProduct(item)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="text-sm font-semibold text-slate-900">{item.nombre}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.codigo_barras}</div>
                      <div className="mt-3 text-lg font-semibold text-slate-900">
                        {formatMoney(item.precio)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-900/10 bg-[color:var(--ticket)] p-6 text-slate-100 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Ticket</h2>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                {cart.length} items
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-200">
                  Carrito vacio. Escanea un producto para comenzar.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{item.nombre}</div>
                        <div className="text-xs text-slate-300">
                          {item.codigo_barras || 'Sin codigo'}
                        </div>
                      </div>
                      <div className="text-lg font-semibold">
                        {formatMoney(item.subtotal)}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => decrementItem(item.id)}
                          className="h-11 w-11 rounded-xl border border-white/20 bg-white/10 text-lg font-semibold transition hover:bg-white/20"
                        >
                          -
                        </button>
                        <div className="min-w-[48px] text-center text-lg font-semibold">
                          {item.cantidad}
                        </div>
                        <button
                          type="button"
                          onClick={() => incrementItem(item.id)}
                          className="h-11 w-11 rounded-xl border border-white/20 bg-white/10 text-lg font-semibold transition hover:bg-white/20"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded-xl border border-rose-200/30 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6">
              <PosTerminal
                cart={cart}
                onBoletaSuccess={handleBoletaSuccess}
                showItems={false}
                showHeader={false}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
