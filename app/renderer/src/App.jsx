import React, { useMemo, useState } from 'react';
import Layout from './components/Layout.jsx';
import POS from './pages/POS.jsx';
import Inventory from './pages/Inventory.jsx';
import Settings from './pages/Settings.jsx';

const VIEW_MAP = {
  pos: {
    key: 'pos',
    title: 'Ventas',
    component: POS,
  },
  inventario: {
    key: 'inventario',
    title: 'Inventario',
    component: Inventory,
  },
  configuracion: {
    key: 'configuracion',
    title: 'Configuracion',
    component: Settings,
  },
};

export default function App() {
  const [activeView, setActiveView] = useState('pos');

  const ActiveComponent = useMemo(() => {
    const entry = VIEW_MAP[activeView] || VIEW_MAP.pos;
    return entry.component;
  }, [activeView]);

  return (
    <Layout active={activeView} onNavigate={setActiveView}>
      <ActiveComponent />
    </Layout>
  );
}
