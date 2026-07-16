import React, { useState, useEffect } from 'react';
import { markNotificationAsRead } from '../lib/api';
import { Bell, CheckCircle2, Circle, Wrench, DollarSign, FileText, Users, ArrowRight } from 'lucide-react';
import { Page } from '../types';

export default function NotificationsTenant({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications(false);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      // Always fetch main notifications without pagination limits
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications/my?archive=false&limit=100`, {
        credentials: 'include'
      });
      if(res.ok) {
        const result = await res.json();
        setNotifications(result.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function handleMarkAsRead(n: any) {
    if (n.is_read) return;
    try {
      await markNotificationAsRead(n.id);
      setNotifications(prev => prev.map(notif => notif.id === n.id ? {...notif, is_read: 1} : notif));
    } catch (error) {
      console.error(error);
    }
  }

  const getStyle = (title: string, type: string) => {
    const t = (title || '').toLowerCase();
    if (t.includes('sửa chữa') || type === 'repair') return { icon: Wrench, color: 'text-wood-600', bg: 'bg-wood-100', border: 'border-wood-200' };
    if (t.includes('tiền') || t.includes('hóa đơn') || type === 'invoice' || type === 'payment') return { icon: DollarSign, color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200' };
    if (t.includes('hợp đồng') || type === 'contract') return { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' };
    if (t.includes('người') || type === 'tenant') return { icon: Users, color: 'text-sage-600', bg: 'bg-sage-100', border: 'border-sage-200' };
    return { icon: Bell, color: 'text-charcoal-500', bg: 'bg-charcoal-100', border: 'border-charcoal-200' };
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">
            Thông báo
          </h1>
          <p className="text-charcoal-400 mt-2 text-sm">Xem các cập nhật mới nhất từ hệ thống và chủ trọ</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-charcoal-200 border-t-charcoal-900 rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-white/60 py-24 px-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white/60 backdrop-blur-xl">
            {/* Decorative background blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-60">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-terra-100/80 rounded-full mix-blend-multiply filter blur-3xl"></div>
              <div className="absolute top-24 -left-24 w-96 h-96 bg-wood-100/80 rounded-full mix-blend-multiply filter blur-3xl"></div>
              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-sage-100/80 rounded-full mix-blend-multiply filter blur-3xl"></div>
            </div>
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-28 h-28 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-terra-500/10 border border-white/80">
                <div className="w-20 h-20 bg-gradient-to-tr from-terra-50 to-wood-50 rounded-full flex items-center justify-center border border-terra-100/50">
                  <Bell className="w-9 h-9 text-terra-600/80" />
                </div>
              </div>
              <h3 className="text-3xl font-serif text-charcoal-900 mb-4 tracking-tight">Chưa có thông báo nào</h3>
              <p className="text-charcoal-500 text-lg max-w-md mx-auto leading-relaxed">
                Khi có hóa đơn mới, nhắc nhở hợp đồng hay cập nhật sửa chữa, hệ thống sẽ báo ngay cho bạn tại đây.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {notifications.map(n => {
              const style = getStyle(n.title, n.notification_type || '');
              const Icon = style.icon;
              return (
                <div 
                  key={n.id}
                  onClick={() => {
                    handleMarkAsRead(n);
                    if (n.action_url && onNavigate) {
                      onNavigate(n.action_url.replace('/', '') as Page);
                    }
                  }}
                  className={`group relative bg-white/80 backdrop-blur-xl rounded-[1.5rem] border ${n.is_read ? 'border-white' : style.border} p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden ${!n.is_read ? 'shadow-[0_8px_30px_rgb(0,0,0,0.04)]' : ''}`}
                >
                  {/* Unread indicator bar */}
                  {!n.is_read && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${style.bg.replace('bg-', 'bg-').replace('100', '400')}`} />
                  )}
                  
                  <div className="flex gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${n.is_read ? 'bg-charcoal-50 text-charcoal-300' : `${style.bg} ${style.color}`}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h3 className={`text-lg font-serif tracking-tight truncate ${n.is_read ? 'text-charcoal-500' : 'text-charcoal-900'}`}>
                          {n.title}
                        </h3>
                        <span className="text-[11px] font-medium text-charcoal-400 uppercase tracking-wider shrink-0 mt-1">
                          {new Date(n.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </div>
                      <p className={`text-sm leading-relaxed line-clamp-2 ${n.is_read ? 'text-charcoal-400' : 'text-charcoal-600'}`}>
                        {n.content}
                      </p>
                    </div>

                    {n.action_url && (
                      <div className="flex flex-col items-end justify-center shrink-0 ml-4">
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-charcoal-50 text-charcoal-400 group-hover:bg-charcoal-900 group-hover:text-white transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
