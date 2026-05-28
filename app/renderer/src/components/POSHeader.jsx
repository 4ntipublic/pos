import React, { useEffect, useState } from 'react';

const STATUS_MAP = {
  ok: {
    label: 'OK',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
  },
  warn: {
    label: 'AVISO',
    className: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
  },
  error: {
    label: 'ERROR',
    className: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
  },
};

const formatClock = (date) =>
  date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function POSHeader({ cashierName, terminalName, statuses }) {
  const [clock, setClock] = useState(formatClock(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatClock(new Date()));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const badge = (label, statusKey) => {
    const status = STATUS_MAP[statusKey] || STATUS_MAP.warn;
    return (
      <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
        <span>{label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${status.className}`}>
          {status.label}
        </span>
      </div>
    );
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-lg font-bold text-emerald-300">
          POS
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Terminal</div>
          <div className="text-lg font-semibold text-slate-100">{terminalName}</div>
          <div className="text-xs text-slate-400">Cajero: {cashierName}</div>
        </div>
      </div>

      <div className="hidden items-center gap-3 lg:flex">
        {badge('Lector USB', statuses.usb)}
        {badge('Impresora', statuses.printer)}
        {badge('SII', statuses.sii)}
      </div>

      <div className="text-right">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Hora</div>
        <div className="text-lg font-semibold text-slate-100">{clock}</div>
      </div>
    </header>
  );
}
