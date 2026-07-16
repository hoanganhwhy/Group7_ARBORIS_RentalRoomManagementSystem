import { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/ui/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { TenantDashboard } from './pages/TenantDashboard';
import { Rooms } from './pages/Rooms';
import { Tenants } from './pages/Tenants';
import { TenantAccounts } from './pages/TenantAccounts';
import { MeterReadings } from './pages/MeterReadings';
import { Invoices } from './pages/Invoices';
import { Repairs } from './pages/Repairs';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AiChatbot } from './components/ui/AiChatbot';
import NotificationsTenant from './pages/NotificationsTenant';
import NotificationsAdmin from './pages/NotificationsAdmin';
import type { Page } from './types';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-cream-50"><div className="w-8 h-8 border-4 border-terra-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        if (user?.role === 'GUEST') return <div className="p-8 text-center"><h1 className="text-2xl font-bold text-terra-600 mb-4">Chào mừng bạn!</h1><p>Bạn đã đăng nhập thành công. Hãy liên hệ Chủ nhà để được xếp phòng nhé.</p></div>;
        return user?.role === 'TENANT' ? <TenantDashboard onNavigate={setCurrentPage} /> : <Dashboard onNavigate={setCurrentPage} />;
      case 'rooms':
        return <Rooms />;
      case 'tenants':
        return <Tenants />;
      case 'tenant-accounts':
        return <TenantAccounts />;
      case 'meter-readings':
        return <MeterReadings />;
      case 'invoices':
        return <Invoices />;
      case 'repairs':
        return <Repairs />;
      case 'notifications':
        return user?.role === 'TENANT' ? <NotificationsTenant onNavigate={setCurrentPage} /> : <NotificationsAdmin onNavigate={setCurrentPage} />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
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
        <ErrorBoundary>
          <div className="py-10 px-12 max-w-6xl mx-auto">
            {renderPage()}
          </div>
        </ErrorBoundary>
      </main>

      <AiChatbot />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
