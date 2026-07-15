import { useEffect, useState } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { TenantDashboard } from './pages/TenantDashboard';
import NotificationsAdmin from './pages/NotificationsAdmin';
import NotificationsTenant from './pages/NotificationsTenant';
import { ChatAdmin } from './pages/ChatAdmin';
import { ChatTenant } from './pages/ChatTenant';
import { Rooms } from './pages/Rooms';
import { Tenants } from './pages/Tenants';
import { UserManagement } from './pages/UserManagement';
import { MeterReadings } from './pages/MeterReadings';
import { Invoices } from './pages/Invoices';
import { Repairs } from './pages/Repairs';
import { Login } from './pages/Login';
import { AccountSetup } from './pages/AccountSetup';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AiChatbot } from './components/ui/AiChatbot';
import type { Page } from './types';

function AppContent() {
  const { user, loading, updateUser } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [activationToast, setActivationToast] = useState(false);

  useEffect(() => {
    if (loading) return;
    const tenantNeedsSetup = user?.role === 'TENANT' && user.nextStep !== 'DASHBOARD';
    const nextPath = !user
      ? '/login'
      : tenantNeedsSetup
        ? '/account-setup'
        : '/';
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', nextPath);
    }
  }, [loading, user]);

  useEffect(() => {
    if (!activationToast) return undefined;
    const timeoutId = window.setTimeout(() => setActivationToast(false), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [activationToast]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-cream-50"><div className="w-8 h-8 border-4 border-terra-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!user) {
    return <Login />;
  }

  if (user.role === 'TENANT' && user.nextStep !== 'DASHBOARD') {
    return (
      <AccountSetup
        onActivated={(activatedUser) => {
          setActivationToast(true);
          updateUser(activatedUser);
        }}
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        if (user?.role === 'GUEST') return <div className="p-8 text-center"><h1 className="text-2xl font-bold text-terra-600 mb-4">Chào mừng bạn!</h1><p>Bạn đã đăng nhập thành công. Hãy liên hệ Chủ nhà để được xếp phòng nhé.</p></div>;
        return user?.role === 'TENANT'
          ? <TenantDashboard onNavigate={(page) => setCurrentPage(page as Page)} />
          : <Dashboard onNavigate={setCurrentPage} />;
      case 'rooms':
        return <Rooms />;
      case 'tenants':
        return <Tenants />;
      case 'user-management':
        return <UserManagement />;
      case 'meter-readings':
        return <MeterReadings />;
      case 'invoices':
        return <Invoices />;
      case 'repairs':
        return <Repairs />;
      case 'notifications':
        return user?.role === 'TENANT' ? <NotificationsTenant onNavigate={setCurrentPage} /> : <NotificationsAdmin onNavigate={setCurrentPage} />;
      case 'chat':
        return user?.role === 'TENANT' ? <ChatTenant /> : <ChatAdmin />;

      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex">
{/* Luxury Scandinavian Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-cream-50" style={{ zIndex: 0 }}>
        {/* Soft Wood Brown gradient wash */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-wood-100/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-wood-50/50 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
      </div>

      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 ml-72 min-h-screen relative" style={{ zIndex: 1 }}>
        <div className="py-10 px-12 max-w-6xl mx-auto">
          {renderPage()}
        </div>
      </main>

      <AiChatbot />

      {activationToast && (
        <div
          role="status"
          className="fixed right-5 top-5 z-[100] rounded-2xl border border-sage-200 bg-white px-5 py-4 text-sm font-semibold text-sage-800 shadow-elevated"
        >
          Kích hoạt tài khoản thành công
        </div>
      )}
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
