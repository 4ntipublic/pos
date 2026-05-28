import React, { useEffect, useState } from 'react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    const loadProducts = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const hasApi =
          typeof window !== 'undefined' &&
          window.api &&
          typeof window.api.getProducts === 'function';

        if (!hasApi) {
          throw new Error('API no disponible');
        }

        const response = await window.api.getProducts();

        if (!response || typeof response.ok !== 'boolean') {
          throw new Error('Respuesta invalida del backend');
        }

        if (!response.ok) {
          const message = response.error && response.error.message
            ? String(response.error.message)
            : 'No se pudieron cargar los productos';

          if (isActive) {
            setErrorMessage(message);
            setProducts([]);
          }
          return;
        }

        const rows = Array.isArray(response.data) ? response.data : [];
        if (isActive) {
          setProducts(rows);
        }
      } catch (err) {
        console.error('[ui] inventory load failed', err);
        if (isActive) {
          setErrorMessage(err && err.message ? String(err.message) : 'Error inesperado');
          setProducts([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-600">
          Inventario
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">Productos</h1>
        <p className="text-sm text-slate-600">
          Gestiona existencia, precios y movimientos en tiempo real.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
          <div className="text-sm font-semibold">No se pudo cargar el inventario</div>
          <div className="text-sm opacity-80">{errorMessage}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-slate-700 shadow-sm">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Cargando...</div>
          <div className="mt-2 text-base">Consultando base de datos.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-900 text-white">
                <tr className="text-xs uppercase tracking-[0.2em]">
                  <th className="px-4 py-4 font-semibold">ID</th>
                  <th className="px-4 py-4 font-semibold">Codigo barras</th>
                  <th className="px-4 py-4 font-semibold">Producto</th>
                  <th className="px-4 py-4 font-semibold">Precio</th>
                  <th className="px-4 py-4 font-semibold">Stock</th>
                  <th className="px-4 py-4 font-semibold">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                      No hay productos registrados.
                    </td>
                  </tr>
                ) : (
                  products.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-5 text-base text-slate-800">{item.id}</td>
                      <td className="px-4 py-5 text-base text-slate-800">
                        {item.codigo_barras || 'N/A'}
                      </td>
                      <td className="px-4 py-5 text-base font-medium text-slate-900">
                        {item.nombre}
                      </td>
                      <td className="px-4 py-5 text-base text-slate-800">
                        {item.precio}
                      </td>
                      <td className="px-4 py-5 text-base text-slate-800">{item.stock}</td>
                      <td className="px-4 py-5 text-base text-slate-800">
                        {item.categoria_id ?? 'Sin categoria'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
