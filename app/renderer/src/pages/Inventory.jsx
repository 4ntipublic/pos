import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const emptyForm = {
  codigo_barras: '',
  nombre: '',
  precio: '',
  stock: '',
  categoria_id: '',
};

const formatMoney = (value) => {
  const amount = Math.round(Number(value) || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeProduct = (item) => ({
  id: item && item.id != null ? item.id : null,
  codigo_barras: item && item.codigo_barras ? String(item.codigo_barras) : '',
  nombre: item && item.nombre ? String(item.nombre) : '',
  precio: toNumber(item && item.precio),
  stock: Number.isFinite(Number(item && item.stock)) ? Number(item.stock) : 0,
  categoria_id: item && item.categoria_id != null ? item.categoria_id : '',
});

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toastRef = useRef(null);

  const showToast = useCallback((variant, message) => {
    setToast({ variant, message });
    if (toastRef.current) {
      clearTimeout(toastRef.current);
    }
    toastRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const loadProducts = useCallback(async (reason) => {
    setLoading(true);
    setErrorMessage('');

    try {
      if (!window.api || typeof window.api.getProducts !== 'function') {
        throw new Error('API no disponible');
      }

      console.info('[inventory] load products', { reason });
      const response = await window.api.getProducts();

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        const message = response.error && response.error.message
          ? String(response.error.message)
          : 'No se pudieron cargar los productos';
        throw new Error(message);
      }

      const rows = Array.isArray(response.data) ? response.data : [];
      const mapped = rows.map(normalizeProduct);
      setProducts(mapped);
    } catch (err) {
      console.error('[inventory] load failed', err);
      setErrorMessage(err && err.message ? String(err.message) : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts('init');
    return () => {
      if (toastRef.current) {
        clearTimeout(toastRef.current);
      }
    };
  }, [loadProducts]);

  const resetForm = () => {
    setFormValues(emptyForm);
    setFormErrors({});
    setEditingProduct(null);
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setFormValues({
      codigo_barras: product.codigo_barras || '',
      nombre: product.nombre || '',
      precio: String(product.precio ?? ''),
      stock: String(product.stock ?? ''),
      categoria_id: product.categoria_id != null ? String(product.categoria_id) : '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openDelete = (product) => {
    setDeleteTarget(product);
    setIsDeleteOpen(true);
  };

  const closeModals = () => {
    setIsModalOpen(false);
    setIsDeleteOpen(false);
    setIsSaving(false);
    setDeleteTarget(null);
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!String(formValues.codigo_barras || '').trim()) {
      nextErrors.codigo_barras = 'Codigo de barras obligatorio';
    }
    if (!String(formValues.nombre || '').trim()) {
      nextErrors.nombre = 'Nombre obligatorio';
    }
    const precio = Number(formValues.precio);
    if (!Number.isFinite(precio) || precio < 0) {
      nextErrors.precio = 'Precio invalido';
    }
    const stock = Number(formValues.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      nextErrors.stock = 'Stock invalido';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        codigo_barras: String(formValues.codigo_barras || '').trim(),
        nombre: String(formValues.nombre || '').trim(),
        precio: Number(formValues.precio) || 0,
        stock: Number(formValues.stock) || 0,
        categoria_id: formValues.categoria_id ? Number(formValues.categoria_id) : null,
      };

      const hasApi = window.api && typeof window.api.createProduct === 'function';
      if (!hasApi) {
        throw new Error('API no disponible');
      }

      let response;
      if (editingProduct && editingProduct.id != null) {
        response = await window.api.updateProduct({ id: editingProduct.id, ...payload });
      } else {
        response = await window.api.createProduct(payload);
      }

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        const message =
          response.error && response.error.message
            ? response.error.message
            : response.error || 'No se pudo guardar el producto';
        throw new Error(message);
      }

      showToast('success', editingProduct ? 'Producto actualizado' : 'Producto creado');
      closeModals();
      resetForm();
      loadProducts('save');
    } catch (err) {
      console.error('[inventory] save failed', err);
      showToast('error', err && err.message ? String(err.message) : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      if (!window.api || typeof window.api.deleteProduct !== 'function') {
        throw new Error('API no disponible');
      }

      const response = await window.api.deleteProduct(deleteTarget.id);
      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        const message =
          response.error && response.error.message
            ? response.error.message
            : response.error || 'No se pudo eliminar';
        throw new Error(message);
      }

      showToast('success', 'Producto eliminado');
      closeModals();
      setDeleteTarget(null);
      loadProducts('delete');
    } catch (err) {
      console.error('[inventory] delete failed', err);
      showToast('error', err && err.message ? String(err.message) : 'Error al eliminar');
    }
  };

  const list = useMemo(() => products, [products]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-[0.35em] text-emerald-300">Inventario</div>
        <h1 className="text-3xl font-semibold text-slate-100">Gestion de productos</h1>
        <p className="text-sm text-slate-400">
          Crea, edita y elimina productos sin detener la operacion.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Total productos: <span className="font-semibold text-slate-100">{list.length}</span>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-2xl border border-emerald-400/60 bg-emerald-500 px-6 py-4 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-emerald-400 active:scale-[0.98]"
        >
          Nuevo Producto
        </button>
      </div>

      {toast ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            toast.variant === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
              : 'border-rose-400/40 bg-rose-500/15 text-rose-100'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-4 text-rose-200">
          <div className="text-sm font-semibold">No se pudo cargar el inventario</div>
          <div className="text-sm opacity-80">{errorMessage}</div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/50 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-950 text-slate-100">
              <tr className="text-xs uppercase tracking-[0.25em]">
                <th className="px-4 py-4 font-semibold">ID</th>
                <th className="px-4 py-4 font-semibold">Codigo barras</th>
                <th className="px-4 py-4 font-semibold">Producto</th>
                <th className="px-4 py-4 font-semibold">Precio</th>
                <th className="px-4 py-4 font-semibold">Stock</th>
                <th className="px-4 py-4 font-semibold">Categoria</th>
                <th className="px-4 py-4 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-400" colSpan={7}>
                    Cargando inventario...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-400" colSpan={7}>
                    No hay productos registrados.
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-5 text-sm text-slate-300">{item.id}</td>
                    <td className="px-4 py-5 text-sm text-slate-300">
                      {item.codigo_barras || 'N/A'}
                    </td>
                    <td className="px-4 py-5 text-base font-semibold text-slate-100">
                      {item.nombre}
                    </td>
                    <td className="px-4 py-5 text-sm text-emerald-200">
                      {formatMoney(item.precio)}
                    </td>
                    <td className="px-4 py-5 text-sm text-slate-200">{item.stock}</td>
                    <td className="px-4 py-5 text-sm text-slate-400">
                      {item.categoria_id || 'Sin categoria'}
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(item)}
                          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-800 bg-slate-950 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                  {editingProduct ? 'Editar producto' : 'Nuevo producto'}
                </div>
                <h2 className="text-2xl font-semibold text-slate-100">Ficha de producto</h2>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                Codigo de barras
                <input
                  value={formValues.codigo_barras}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, codigo_barras: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="780000000000"
                />
                {formErrors.codigo_barras ? (
                  <div className="text-xs text-rose-300">{formErrors.codigo_barras}</div>
                ) : null}
              </label>

              <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                Nombre
                <input
                  value={formValues.nombre}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="Producto"
                />
                {formErrors.nombre ? (
                  <div className="text-xs text-rose-300">{formErrors.nombre}</div>
                ) : null}
              </label>

              <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                Precio
                <input
                  type="number"
                  min="0"
                  value={formValues.precio}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, precio: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="0"
                />
                {formErrors.precio ? (
                  <div className="text-xs text-rose-300">{formErrors.precio}</div>
                ) : null}
              </label>

              <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                Stock
                <input
                  type="number"
                  min="0"
                  value={formValues.stock}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, stock: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="0"
                />
                {formErrors.stock ? (
                  <div className="text-xs text-rose-300">{formErrors.stock}</div>
                ) : null}
              </label>

              <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400 sm:col-span-2">
                Categoria (opcional)
                <input
                  value={formValues.categoria_id}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, categoria_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="ID categoria"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeModals}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-2xl border border-emerald-400/60 bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-[28px] border border-slate-800 bg-slate-950 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
            <div className="text-xs uppercase tracking-[0.35em] text-rose-300">Eliminar</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Confirmar eliminacion</h2>
            <p className="mt-3 text-sm text-slate-400">
              Vas a eliminar <span className="font-semibold text-slate-200">{deleteTarget?.nombre}</span>.
              Esta accion no se puede deshacer.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModals}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-2xl border border-rose-500/60 bg-rose-500/20 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
              >
                Eliminar producto
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
