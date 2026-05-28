import React from 'react';
import Sidebar from './Sidebar.jsx';

export default function Layout({ children, active = 'pos', onNavigate }) {
  return (
    <div className="min-h-screen w-full font-['Space_Grotesk'] text-slate-100">
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-[-20%] h-80 w-80 rounded-full bg-emerald-500/20 blur-[120px]" />
          <div className="absolute top-1/4 right-[-15%] h-[26rem] w-[26rem] rounded-full bg-cyan-500/15 blur-[140px]" />
          <div className="absolute bottom-[-20%] left-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-[160px]" />
        </div>

        <div className="relative z-10 flex min-h-screen w-full">
          <Sidebar active={active} onNavigate={onNavigate} />
          <main className="flex-1 px-6 py-6">
            <div className="min-h-[calc(100vh-3rem)] rounded-[32px] border border-slate-800 bg-slate-950/80 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
