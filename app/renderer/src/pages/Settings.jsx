import React, { useCallback, useEffect, useRef, useState } from 'react';

const emptyConfig = {
  fantasyName: '',
  legalName: '',
  address: '',
  logoPath: '',
  logoDataUrl: '',
  logoName: '',
};

export default function Settings() {
  const [formValues, setFormValues] = useState(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
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

  const loadSettings = useCallback(async () => {
    setLoading(true);

    try {
      if (!window.api || typeof window.api.getReceiptConfig !== 'function') {
        throw new Error('API no disponible');
      }

      const response = await window.api.getReceiptConfig();
      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        const message =
          response.error && response.error.message
            ? response.error.message
            : response.error || 'No se pudo cargar configuracion';
        throw new Error(message);
      }

      setFormValues({
        fantasyName: response.data?.fantasyName || '',
        legalName: response.data?.legalName || '',
        address: response.data?.address || '',
        logoPath: response.data?.logoPath || '',
        logoDataUrl: response.data?.logoDataUrl || '',
        logoName: response.data?.logoName || '',
      });
    } catch (err) {
      console.error('[settings] load failed', err);
      showToast('error', err && err.message ? String(err.message) : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSettings();
    return () => {
      if (toastRef.current) {
        clearTimeout(toastRef.current);
      }
    };
  }, [loadSettings]);

  const handleSave = async () => {
    if (saving) {
      return;
    }

    try {
      setSaving(true);

      if (!window.api || typeof window.api.saveReceiptConfig !== 'function') {
        throw new Error('API no disponible');
      }

      const payload = {
        fantasyName: String(formValues.fantasyName || '').trim(),
        legalName: String(formValues.legalName || '').trim(),
        address: String(formValues.address || '').trim(),
        logoPath: formValues.logoPath || '',
        logoDataUrl: formValues.logoDataUrl || '',
        logoName: formValues.logoName || '',
      };

      const response = await window.api.saveReceiptConfig(payload);
      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        const message =
          response.error && response.error.message
            ? response.error.message
            : response.error || 'No se pudo guardar configuracion';
        throw new Error(message);
      }

      showToast('success', 'Configuracion guardada');
      setFormValues({
        fantasyName: response.data?.fantasyName || payload.fantasyName,
        legalName: response.data?.legalName || payload.legalName,
        address: response.data?.address || payload.address,
        logoPath: response.data?.logoPath || payload.logoPath,
        logoDataUrl: response.data?.logoDataUrl || payload.logoDataUrl,
        logoName: response.data?.logoName || payload.logoName,
      });
    } catch (err) {
      console.error('[settings] save failed', err);
      showToast('error', err && err.message ? String(err.message) : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLogo = async () => {
    try {
      if (!window.api || typeof window.api.selectReceiptLogo !== 'function') {
        throw new Error('API no disponible');
      }

      const response = await window.api.selectReceiptLogo();
      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Respuesta invalida del backend');
      }

      if (!response.ok) {
        if (response.canceled) {
          return;
        }
        const message =
          response.error && response.error.message
            ? response.error.message
            : response.error || 'No se pudo seleccionar logo';
        throw new Error(message);
      }

      setFormValues((prev) => ({
        ...prev,
        logoPath: response.path || '',
        logoDataUrl: response.dataUrl || '',
        logoName: response.name || '',
      }));
    } catch (err) {
      console.error('[settings] select logo failed', err);
      showToast('error', err && err.message ? String(err.message) : 'Error al seleccionar logo');
    }
  };

  const handleClearLogo = () => {
    setFormValues((prev) => ({ ...prev, logoPath: '', logoDataUrl: '', logoName: '' }));
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-[0.35em] text-emerald-300">Configuracion</div>
        <h1 className="text-3xl font-semibold text-slate-100">Personalizacion de boleta</h1>
        <p className="text-sm text-slate-400">
          Ajusta datos de la empresa y el logo que aparecera en el ticket.
        </p>
      </header>

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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/60 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="space-y-4">
            <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              Nombre de fantasia
              <input
                value={formValues.fantasyName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, fantasyName: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Mi Empresa"
                disabled={loading}
              />
            </label>

            <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              Razon social
              <input
                value={formValues.legalName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, legalName: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Sociedad Limitada"
                disabled={loading}
              />
            </label>

            <label className="space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              Direccion
              <input
                value={formValues.address}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, address: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-base text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Av. Central 123"
                disabled={loading}
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={loadSettings}
              className="rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-300"
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl border border-emerald-400/60 bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-800 bg-slate-900/60 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="text-xs uppercase tracking-[0.35em] text-emerald-300">Logo</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Logo de empresa</h2>
          <p className="mt-2 text-sm text-slate-400">
            Se imprimira en la cabecera del ticket.
          </p>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
            {formValues.logoDataUrl ? (
              <img
                src={formValues.logoDataUrl}
                alt="Logo"
                className="mx-auto max-h-40 object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <div className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs uppercase tracking-[0.3em]">
                  Sin logo
                </div>
                <div>Selecciona una imagen PNG o JPG.</div>
              </div>
            )}
          </div>

          {formValues.logoName ? (
            <div className="mt-3 text-xs text-slate-400">Archivo: {formValues.logoName}</div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSelectLogo}
              className="rounded-2xl border border-emerald-400/60 bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Seleccionar logo
            </button>
            <button
              type="button"
              onClick={handleClearLogo}
              className="rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-300"
            >
              Quitar logo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
