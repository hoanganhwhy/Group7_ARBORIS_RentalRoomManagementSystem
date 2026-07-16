import { useEffect, useState } from 'react';
import {
  Home,
  Users,
  DollarSign,
  Clock,
  Wrench,
  FileText,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { Badge, Spinner } from '../components/ui/Input';
import { getDashboardStats, getRepairRequests } from '../lib/api';
import type { Invoice, RepairRequest, Page } from '../types';

export function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStats() {
    try {
      const [dashboardData, repairsData] = await Promise.all([
        getDashboardStats(),
        getRepairRequests({ limit: 10000 } as any),
      ]);

      const allRepairs = repairsData.data || [];
      const pendingRepairs = allRepairs.filter(
        (repair: RepairRequest) =>
          repair.status === 'new' ||
          repair.status === 'in_progress'
      ).length;

      const recentRepairs = [...allRepairs]
        .sort((a: RepairRequest, b: RepairRequest) => {
          const aTime = new Date(
            a.reported_at || (a as any).created_at || 0
          ).getTime();
          const bTime = new Date(
            b.reported_at || (b as any).created_at || 0
          ).getTime();
          return bTime - aTime;
        })
        .slice(0, 5);

      setStats({
        ...dashboardData,
        pendingRepairs,
        recentRepairs,
      } as typeof stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Spinner />;
  if (!stats) return null;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">Tổng quan</h1>
          <p className="text-charcoal-400 mt-2 text-sm">Theo dõi hoạt động quản lý phòng trọ của bạn</p>
        </div>
      </header>

      {/* Stats Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-charcoal-700">Thống kê chung</h2>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <DataCard
            label="Tổng số phòng"
            value={stats.totalRooms.toString()}
            subValue={`${stats.availableRooms} phòng trống`}
            icon={<Home className="w-5 h-5" />}
            onClick={() => onNavigate('rooms')}
          />
          <DataCard
            label="Đang sử dụng"
            value={stats.occupiedRooms.toString()}
            icon={<TrendingUp className="w-5 h-5" />}
            accent
            onClick={() => onNavigate('rooms')}
          />
          <DataCard
            label="Người thuê"
            value={stats.totalTenants.toString()}
            icon={<Users className="w-5 h-5" />}
            onClick={() => onNavigate('tenants')}
          />
          <DataCard
            label="Sửa chữa chờ"
            value={stats.pendingRepairs.toString()}
            icon={<Wrench className="w-5 h-5" />}
            highlight={stats.pendingRepairs > 0}
            onClick={() => onNavigate('repairs')}
          />
        </div>
      </section>

      {/* Financial Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-charcoal-700">Tài chính</h2>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <FinancialCard
            label="Doanh thu đã thu"
            value={stats.totalRevenue}
            icon={<DollarSign className="w-5 h-5" />}
            variant="success"
            onClick={() => onNavigate('invoices')}
          />
          <FinancialCard
            label="Chờ thanh toán"
            value={stats.pendingPayments}
            icon={<Clock className="w-5 h-5" />}
            variant="warning"
            onClick={() => onNavigate('invoices')}
          />
          <FinancialCard
            label="Hóa đơn quá hạn"
            value={stats.overdueInvoices}
            icon={<FileText className="w-5 h-5" />}
            variant={stats.overdueInvoices > 0 ? 'danger' : 'default'}
            onClick={() => onNavigate('invoices')}
            unit="count"
          />
        </div>
      </section>

      {/* Activity Sections */}
      <section className="grid grid-cols-2 gap-8">
        <RecentInvoices invoices={stats.recentInvoices} onNavigate={onNavigate} />
        <RecentRepairs repairs={stats.recentRepairs} onNavigate={onNavigate} />
      </section>
    </div>
  );
}

function DataCard({
  label,
  value,
  subValue,
  icon,
  accent,
  highlight,
  onClick,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  accent?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border ${highlight ? 'border-amber-200' : 'border-charcoal-100'} p-6 shadow-card ${onClick ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-charcoal-400 font-medium">{label}</p>
          <p className={`text-3xl font-semibold mt-3 ${accent ? 'text-terra-600' : 'text-charcoal-900'}`}>
            {value}
          </p>
          {subValue && <p className="text-sm text-charcoal-400 mt-2">{subValue}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          accent ? 'bg-terra-100 text-terra-600' : 'bg-charcoal-50 text-charcoal-400'
        }`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  icon,
  variant,
  onClick,
  unit = 'money',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant: 'success' | 'warning' | 'danger' | 'default';
  onClick?: () => void;
  unit?: 'money' | 'count';
}) {
  const variantStyles = {
    success: { bg: 'bg-sage-50', iconBg: 'bg-sage-100', iconColor: 'text-sage-600', border: 'border-sage-100' },
    warning: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', border: 'border-amber-100' },
    danger: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', border: 'border-rose-100' },
    default: { bg: 'bg-cream-50', iconBg: 'bg-cream-100', iconColor: 'text-charcoal-400', border: 'border-charcoal-100' },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`${style.bg} rounded-2xl border ${style.border} p-6 ${onClick ? 'cursor-pointer hover:brightness-[0.97] hover:-translate-y-0.5 transition-all duration-200' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-charcoal-500 font-medium">{label}</p>
          <p className="text-2xl font-semibold text-charcoal-900 mt-2">
            {unit === 'count' ? `${value} hóa đơn` : `${value.toLocaleString('vi-VN')}đ`}
          </p>
        </div>
        <div className={`w-11 h-11 rounded-xl ${style.iconBg} flex items-center justify-center ${style.iconColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function RecentInvoices({ invoices, onNavigate }: { invoices: Invoice[]; onNavigate: (page: Page) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
      <div
        onClick={() => onNavigate('invoices')}
        className="px-7 py-6 border-b border-charcoal-100 flex items-center justify-between cursor-pointer hover:bg-cream-50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-semibold text-charcoal-900">Hóa đơn gần đây</h3>
          <p className="text-sm text-charcoal-400 mt-1">Các hóa đơn mới nhất trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-terra-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-terra-600" />
          </div>
          <ArrowRight className="w-4 h-4 text-charcoal-300" />
        </div>
      </div>

      <div className="divide-y divide-charcoal-50">
        {invoices.length === 0 ? (
          <div className="px-7 py-10 text-center">
            <p className="text-charcoal-400">Chưa có hóa đơn nào</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              onClick={() => onNavigate('invoices')}
              className="px-7 py-4 flex items-center justify-between hover:bg-cream-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-charcoal-50 flex items-center justify-center text-sm font-medium text-charcoal-600">
                  {invoice.invoice_month}/{invoice.invoice_year.toString().slice(-2)}
                </div>
                <div>
                  <p className="font-medium text-charcoal-900">Phòng {invoice.room?.room_number}</p>
                  <p className="text-sm text-charcoal-400 mt-0.5">{invoice.tenant?.full_name || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-charcoal-900">{Number(invoice.total_amount).toLocaleString('vi-VN')}đ</p>
                  <div className="mt-1">
                    <InvoiceBadge status={invoice.status} />
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-charcoal-300" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentRepairs({ repairs, onNavigate }: { repairs: RepairRequest[]; onNavigate: (page: Page) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden">
      <div
        onClick={() => onNavigate('repairs')}
        className="px-7 py-6 border-b border-charcoal-100 flex items-center justify-between cursor-pointer hover:bg-cream-50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-semibold text-charcoal-900">Yêu cầu sửa chữa</h3>
          <p className="text-sm text-charcoal-400 mt-1">Các yêu cầu mới nhất từ người thuê</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-charcoal-100 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-charcoal-500" />
          </div>
          <ArrowRight className="w-4 h-4 text-charcoal-300" />
        </div>
      </div>

      <div className="divide-y divide-charcoal-50">
        {repairs.length === 0 ? (
          <div className="px-7 py-10 text-center">
            <p className="text-charcoal-400">Không có yêu cầu sửa chữa nào</p>
          </div>
        ) : (
          repairs.map((repair) => (
            <div
              key={repair.id}
              onClick={() => onNavigate('repairs')}
              className="px-7 py-4 flex items-center justify-between hover:bg-cream-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-charcoal-50 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-charcoal-400" />
                </div>
                <div>
                  <p className="font-medium text-charcoal-900">{repair.title}</p>
                  <p className="text-sm text-charcoal-400 mt-0.5">Phòng {repair.room?.room_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <RepairBadge status={repair.status} />
                <ArrowRight className="w-4 h-4 text-charcoal-300" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InvoiceBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'warning' | 'danger'> = {
    paid: 'success',
    pending: 'warning',
    overdue: 'danger',
  };
  return <Badge status={status} variant={variants[status] || 'default'} size="sm" />;
}

function RepairBadge({ status }: { status: string }) {
  const variants: Record<string, 'info' | 'warning' | 'success' | 'default'> = {
    new: 'info',
    in_progress: 'warning',
    resolved: 'success',
    closed: 'default',
  };
  return <Badge status={status} variant={variants[status]} size="sm" />;
}
