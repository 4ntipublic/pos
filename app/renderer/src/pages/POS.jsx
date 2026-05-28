import React, { useCallback, useEffect, useState } from 'react';
import POSLayout from '../components/POSLayout.jsx';

const normalizeProduct = (item, index) => ({
  id: item && item.id != null ? item.id : `fallback-${index}`,
  codigo_barras: item && item.codigo_barras ? String(item.codigo_barras) : '',
  nombre: String(item && item.nombre ? item.nombre : `Producto ${index + 1}`),
  precio: Number(item && item.precio) || 0,
  stock: Number.isFinite(Number(item && item.stock)) ? Number(item.stock) : 0,
});

export default function POS() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [printerStatus, setPrinterStatus] = useState('ok');

  const loadProducts = useCallback(async (reason) => {
    try {
      setLoadingProducts(true);

      if (!window.api || typeof window.api.getProducts !== 'function') {
        throw new Error('API no disponible');
      }

      console.info('[pos] load products', { reason });
      const response = await window.api.getProducts();

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        const message =
          response.error && response.error.message
            ? response.error.message
            : response.error || 'No se pudo cargar inventario';
        throw new Error(message);
      }

      const rows = Array.isArray(response.data) ? response.data : [];
      const mapped = rows.map(normalizeProduct);
      setProducts(mapped);
    } catch (err) {
      console.error('[pos] load products failed', err);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts('init');
  }, [loadProducts]);

  const handleCharge = useCallback(async (payload) => {
    if (!window.api || typeof window.api.completeSale !== 'function') {
      throw new Error('API no disponible');
    }

    const response = await window.api.completeSale(payload);
    if (!response || typeof response.ok !== 'boolean') {
      throw new Error('Respuesta invalida del backend');
    }

    if (!response.ok) {
      const message =
        response.error && response.error.message
          ? response.error.message
          : response.error || 'No se pudo registrar la venta';
      throw new Error(message);
    }

    if (response.print && response.print.ok === false) {
      setPrinterStatus('warn');
    } else {
      setPrinterStatus('ok');
    }

    return response;
  }, []);

  return (
    <POSLayout
      cashierName="Caja 01"
      terminalName="Terminal 3"
      products={products}
      loadingProducts={loadingProducts}
      onCharge={handleCharge}
      onRefreshProducts={loadProducts}
      statuses={{ usb: 'ok', printer: printerStatus, sii: 'warn' }}
    />
  );
}
