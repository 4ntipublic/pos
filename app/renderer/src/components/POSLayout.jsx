import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import POSHeader from './POSHeader.jsx';
import POSProductGrid from './POSProductGrid.jsx';
import POSCart from './POSCart.jsx';
import POSActionPanel from './POSActionPanel.jsx';

const QUICK_PRODUCTS = [
  { id: 'sku-001', nombre: 'Agua 500ml', precio: 900, codigo_barras: '780000111001' },
  { id: 'sku-002', nombre: 'Cafe 250g', precio: 4200, codigo_barras: '780000111002' },
  { id: 'sku-003', nombre: 'Pan molde', precio: 3200, codigo_barras: '780000111003' },
  { id: 'sku-004', nombre: 'Leche 1L', precio: 1300, codigo_barras: '780000111004' },
  { id: 'sku-005', nombre: 'Galletas 200g', precio: 1800, codigo_barras: '780000111005' },
  { id: 'sku-006', nombre: 'Chocolate', precio: 1500, codigo_barras: '780000111006' },
];

const initialState = {
  cart: [],
  search: '',
  toast: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'ADD_ITEM': {
      const next = [...state.cart];
      const existingIndex = next.findIndex((item) => item.id === action.payload.id);
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        const cantidad = existing.cantidad + action.payload.cantidad;
        next[existingIndex] = {
          ...existing,
          cantidad,
          subtotal: cantidad * existing.precio,
        };
        return { ...state, cart: next };
      }
      next.push({
        ...action.payload,
        subtotal: action.payload.cantidad * action.payload.precio,
      });
      return { ...state, cart: next };
    }
    case 'UPDATE_QTY': {
      const next = state.cart
        .map((item) => {
          if (item.id !== action.payload.id) {
            return item;
          }
          const cantidad = Math.max(1, item.cantidad + action.payload.delta);
          return { ...item, cantidad, subtotal: cantidad * item.precio };
        })
        .filter(Boolean);
      return { ...state, cart: next };
    }
    case 'REMOVE_ITEM':
      return { ...state, cart: state.cart.filter((item) => item.id !== action.payload) };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

const calcTotals = (cart) => {
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const iva = subtotal * 0.19;
  const total = subtotal + iva;
  return { subtotal, iva, total };
};

const findProduct = (query, list) => {
  const normalized = String(query || '').trim();
  if (!normalized) {
    return null;
  }

  const byBarcode = list.find((item) => String(item.codigo_barras || '') === normalized);
  if (byBarcode) {
    return byBarcode;
  }

  const byName = list.find(
    (item) => String(item.nombre || '').toLowerCase() === normalized.toLowerCase()
  );
  if (byName) {
    return byName;
  }

  return null;
};

export default function POSLayout({
  cashierName = 'Caja 01',
  terminalName = 'Terminal 3',
  products = QUICK_PRODUCTS,
  statuses = { usb: 'ok', printer: 'ok', sii: 'warn' },
  loadingProducts = false,
  onCharge,
  onRefreshProducts,
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isPaying, setIsPaying] = useState(false);
  const toastTimerRef = useRef(null);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef(null);

  const totals = useMemo(() => calcTotals(state.cart), [state.cart]);

  const showToast = useCallback((variant, message) => {
    dispatch({ type: 'SHOW_TOAST', payload: { variant, message } });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      dispatch({ type: 'CLEAR_TOAST' });
    }, 4000);
  }, []);

  const handleAddProduct = useCallback(
    (product) => {
      try {
        if (!product) {
          return;
        }
        dispatch({
          type: 'ADD_ITEM',
          payload: {
            id: product.id,
            nombre: product.nombre,
            precio: Number(product.precio) || 0,
            codigo_barras: product.codigo_barras || '',
            cantidad: 1,
          },
        });
      } catch (err) {
        console.error('[pos] add product failed', err);
        showToast('error', 'Error al agregar producto');
      }
    },
    [showToast]
  );

  const handleSearchSubmit = useCallback(
    (query) => {
      try {
        const match = findProduct(query, products);
        if (!match) {
          showToast('error', 'Producto no encontrado');
          return;
        }
        handleAddProduct(match);
        dispatch({ type: 'SET_SEARCH', payload: '' });
      } catch (err) {
        console.error('[pos] search submit failed', err);
        showToast('error', 'Busqueda fallida');
      }
    },
    [products, handleAddProduct, showToast]
  );

  const handleCharge = useCallback(
    async ({ amount, mode }) => {
      if (isPaying) {
        return;
      }
      try {
        if (state.cart.length === 0) {
          showToast('error', 'Carrito vacio');
          return;
        }

        setIsPaying(true);
        console.info('[pos] cobrar start', { amount, mode, total: totals.total });

        const payload = {
          items: state.cart.map((item) => ({
            id: item.id,
            nombre: item.nombre,
            precio: Number(item.precio) || 0,
            cantidad: Number(item.cantidad) || 1,
            subtotal: Number(item.subtotal) || 0,
            codigo_barras: item.codigo_barras || '',
          })),
          subtotal: totals.subtotal,
          iva: totals.iva,
          total: totals.total,
          payment: { amount: Number(amount) || 0, mode },
          terminal: terminalName,
          cashier: cashierName,
        };

        const chargeAction =
          typeof onCharge === 'function'
            ? onCharge
            : async (data) => {
                if (!window.api || typeof window.api.completeSale !== 'function') {
                  throw new Error('API no disponible');
                }
                return window.api.completeSale(data);
              };

        const result = await chargeAction(payload);
        if (!result || typeof result.ok !== 'boolean') {
          throw new Error('Respuesta invalida del backend');
        }
        if (!result.ok) {
          const message =
            result.error && result.error.message
              ? result.error.message
              : result.error || 'No se pudo registrar la venta';
          throw new Error(message);
        }

        if (result.print && result.print.ok === false) {
          showToast('warn', 'Venta registrada. Impresion simulada.');
        } else {
          showToast('success', 'Venta registrada e impresa');
        }

        dispatch({ type: 'CLEAR_CART' });
        if (typeof onRefreshProducts === 'function') {
          await onRefreshProducts('sale');
        }
      } catch (err) {
        console.error('[pos] cobrar failed', err);
        showToast('error', err && err.message ? String(err.message) : 'No se pudo cobrar');
      } finally {
        setIsPaying(false);
      }
    },
    [cashierName, isPaying, onCharge, onRefreshProducts, showToast, state.cart, terminalName, totals]
  );

  const handleCancel = useCallback(() => {
    try {
      if (state.cart.length === 0) {
        return;
      }
      dispatch({ type: 'CLEAR_CART' });
      showToast('success', 'Venta cancelada');
    } catch (err) {
      console.error('[pos] cancel failed', err);
      showToast('error', 'No se pudo cancelar');
    }
  }, [showToast, state.cart.length]);

  const handleSuspend = useCallback(() => {
    try {
      console.info('[pos] suspend sale');
      showToast('success', 'Venta suspendida');
    } catch (err) {
      console.error('[pos] suspend failed', err);
      showToast('error', 'No se pudo suspender');
    }
  }, [showToast]);

  const handleExact = useCallback(() => {
    handleCharge({ amount: totals.total, mode: 'exact' });
  }, [handleCharge, totals.total]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (event.key === 'Enter') {
        const payload = scanBufferRef.current;
        scanBufferRef.current = '';
        if (payload) {
          handleSearchSubmit(payload);
        }
        return;
      }
      if (event.key.length === 1) {
        scanBufferRef.current += event.key;
        if (scanTimerRef.current) {
          clearTimeout(scanTimerRef.current);
        }
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = '';
        }, 160);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, [handleSearchSubmit]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-full overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-zinc-950 to-slate-900 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-[-10%] h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-[140px]" />
        <div className="absolute top-1/4 right-[-12%] h-[32rem] w-[32rem] rounded-full bg-cyan-500/15 blur-[160px]" />
        <div className="absolute bottom-[-30%] left-1/3 h-[30rem] w-[30rem] rounded-full bg-indigo-500/15 blur-[180px]" />
      </div>

      <div className="relative z-10 grid min-h-[720px] grid-rows-[auto_1fr] gap-6 p-6">
        <div className="rounded-3xl border border-zinc-700/50 bg-zinc-900/70 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <POSHeader
            cashierName={cashierName}
            terminalName={terminalName}
            statuses={statuses}
          />
        </div>

        <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-[1fr_0.42fr]">
          <div className="flex flex-col gap-6">
            {state.toast ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl ${
                  state.toast.variant === 'success'
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                    : state.toast.variant === 'warn'
                      ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                      : 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                }`}
              >
                {state.toast.message}
              </div>
            ) : null}

            <div className="relative rounded-[28px] border border-zinc-700/50 bg-zinc-900/60 shadow-2xl shadow-black/60 backdrop-blur-2xl">
              <POSProductGrid
                products={products}
                searchValue={state.search}
                onSearchChange={(value) => dispatch({ type: 'SET_SEARCH', payload: value })}
                onSearchSubmit={handleSearchSubmit}
                onAddProduct={handleAddProduct}
              />
              {loadingProducts ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-[28px] border border-emerald-500/20 bg-slate-950/80 text-sm font-semibold text-emerald-200">
                  Cargando inventario...
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex h-full flex-col gap-6">
            <div className="rounded-[28px] border border-zinc-700/50 bg-zinc-900/60 shadow-2xl shadow-black/60 backdrop-blur-2xl">
              <POSCart
                items={state.cart}
                totals={totals}
                onIncrement={(id) => dispatch({ type: 'UPDATE_QTY', payload: { id, delta: 1 } })}
                onDecrement={(id) => dispatch({ type: 'UPDATE_QTY', payload: { id, delta: -1 } })}
                onRemove={(id) => dispatch({ type: 'REMOVE_ITEM', payload: id })}
              />
            </div>

            <div className="rounded-[28px] border border-zinc-700/50 bg-zinc-900/60 shadow-2xl shadow-black/60 backdrop-blur-2xl">
              <POSActionPanel
                total={totals.total}
                disabled={isPaying}
                onCancel={handleCancel}
                onSuspend={handleSuspend}
                onExact={handleExact}
                onCharge={handleCharge}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
