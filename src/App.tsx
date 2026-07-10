import { useState } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Rooms } from './pages/Rooms';
import { Tenants } from './pages/Tenants';
import { MeterReadings } from './pages/MeterReadings';
import { Invoices } from './pages/Invoices';
import { Repairs } from './pages/Repairs';
import type { Page } from './types';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'rooms':
        return <Rooms />;
      case 'tenants':
        return <Tenants />;
      case 'meter-readings':
        return <MeterReadings />;
      case 'invoices':
        return <Invoices />;
      case 'repairs':
        return <Repairs />;
      default:
        <Dashboard onNavigate={setCurrentPage} />
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex">
      {/* Decorative background shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {/* Top-right large triangle */}
        <div style={{
          position: 'absolute',
          top: -120,
          right: -100,
          width: 420,
          height: 420,
          background: 'rgba(243, 164, 122, 0.10)',
          clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
        }} />
        {/* Top-right smaller inner triangle */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -20,
          width: 220,
          height: 220,
          background: 'rgba(214, 99, 60, 0.07)',
          clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
        }} />
        {/* Bottom-left triangle */}
        <div style={{
          position: 'absolute',
          bottom: -80,
          left: 288,
          width: 320,
          height: 320,
          background: 'rgba(184, 120, 60, 0.07)',
          clipPath: 'polygon(0 100%, 100% 100%, 50% 0)',
        }} />
        {/* Right-side large circle */}
        <div style={{
          position: 'absolute',
          top: '45%',
          right: -180,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'rgba(248, 201, 172, 0.12)',
        }} />
        {/* Bottom-right amber circle */}
        <div style={{
          position: 'absolute',
          bottom: -120,
          right: 80,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.07)',
        }} />
        {/* Mid-left small circle accent */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: 310,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(214, 99, 60, 0.08)',
        }} />
      </div>

      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 ml-72 min-h-screen relative" style={{ zIndex: 1 }}>
        <div className="py-10 px-12 max-w-6xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
