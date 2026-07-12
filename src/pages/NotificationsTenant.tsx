import React, { useState, useEffect } from 'react';
import { getNotificationDetail, replyNotification, markNotificationAsRead } from '../lib/api';
import { Bell, Send, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/common/Pagination';
import { PageSizeSelector } from '../components/common/PageSizeSelector';

import { Page } from '../types';

export default function NotificationsTenant({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'main' | 'archive'>('main');
  
  // Detail modal
  const [detailNotif, setDetailNotif] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [paginationInfo, setPaginationInfo] = useState({ totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  useEffect(() => {
    loadNotifications();
    
    // Polling every 10 seconds
    const interval = setInterval(() => {
      loadNotifications(false);
    }, 10000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, page, limit]);

  async function loadNotifications(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const isArchive = viewMode === 'archive';
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications/my?archive=${isArchive}&page=${page}&limit=${limit}`, {
        credentials: 'include'
      });
      if(res.ok) {
        const result = await res.json();
        setNotifications(result.data || []);
        if (result.pagination) {
          setPaginationInfo(result.pagination);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function openDetail(n: any) {
    try {
      if (!n.is_read) {
        await markNotificationAsRead(n.id);
        // Optimistically mark as read
        setNotifications(prev => prev.map(notif => notif.id === n.id ? {...notif, is_read: 1} : notif));
      }

      if (n.action_url && onNavigate) {
        const targetPage = n.action_url.replace('/', '') as Page;
        onNavigate(targetPage);
        return; // Do not open detail modal if it's a navigational notification
      }

      const detail = await getNotificationDetail(n.id);
      setDetailNotif(detail.notification);
      setReplies(detail.replies);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!detailNotif || !replyContent.trim()) return;
    try {
      await replyNotification(detailNotif.id, replyContent);
      setReplyContent('');
      openDetail(detailNotif); // Reload replies
      loadNotifications(false); // Update list counts
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi phản hồi');
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm('Xóa thông báo này vào mục lưu trữ?')) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      loadNotifications();
    } catch {
      alert('Lỗi khi xóa');
    }
  }

  async function handleRestore(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications/${id}/restore`, {
        method: 'PATCH',
        credentials: 'include'
      });
      loadNotifications();
    } catch {
      alert('Lỗi khi khôi phục');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-terra-100 rounded-full flex items-center justify-center text-terra-600">
          <Bell className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Thông báo của bạn</h1>
          <p className="text-charcoal-500">Xem và phản hồi thông báo từ chủ trọ</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-charcoal-100 overflow-hidden">
        <div className="flex items-center gap-4 border-b border-charcoal-100 px-6 pt-4">
          <button 
            onClick={() => setViewMode('main')}
            className={`pb-3 px-1 font-medium text-sm transition-colors relative ${viewMode === 'main' ? 'text-terra-600' : 'text-charcoal-500 hover:text-charcoal-800'}`}
          >
            Hộp thư (Tối đa 99 tin)
            {viewMode === 'main' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-terra-500 rounded-t-full"></span>}
          </button>
          <button 
            onClick={() => setViewMode('archive')}
            className={`pb-3 px-1 font-medium text-sm transition-colors relative ${viewMode === 'archive' ? 'text-terra-600' : 'text-charcoal-500 hover:text-charcoal-800'}`}
          >
            Lưu trữ (30 ngày)
            {viewMode === 'archive' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-terra-500 rounded-t-full"></span>}
          </button>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 border-b border-charcoal-100">
          <PageSizeSelector limit={limit} onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }} />
        </div>
        {loading ? (
          <p className="text-charcoal-500 p-6 text-center">Đang tải thông báo...</p>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 px-4 bg-charcoal-50">
            <Bell className="w-12 h-12 text-charcoal-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-charcoal-900">Bạn không có thông báo nào</h3>
            <p className="text-charcoal-500 mt-1">Khi chủ trọ gửi thông báo, nó sẽ xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-100">
            {notifications.map(n => (
              <div 
                key={n.id} 
                className={`flex items-start gap-4 p-5 cursor-pointer transition-colors hover:bg-charcoal-50 ${!n.is_read ? 'bg-terra-50/30' : ''}`}
                onClick={() => openDetail(n)}
              >
                <div className="mt-1">
                  {n.is_read ? (
                    <CheckCircle2 className="w-5 h-5 text-charcoal-300" />
                  ) : (
                    <Circle className="w-5 h-5 text-terra-500 fill-terra-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-medium truncate ${!n.is_read ? 'text-charcoal-900 font-semibold' : 'text-charcoal-700'}`}>
                      {n.title}
                    </h3>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-charcoal-400 whitespace-nowrap ml-4">
                        {new Date(n.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      {viewMode === 'main' ? (
                        <button onClick={(e) => handleDelete(e, n.id)} className="text-xs text-red-500 hover:underline">Xóa</button>
                      ) : (
                        <button onClick={(e) => handleRestore(e, n.id)} className="text-xs text-terra-600 hover:underline">Khôi phục</button>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm line-clamp-2 ${!n.is_read ? 'text-charcoal-800' : 'text-charcoal-500'}`}>
                    {n.content}
                  </p>
                  
                  {n.reply_count > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-terra-600 bg-terra-50 px-2 py-1 rounded-md">
                      <Send className="w-3 h-3" />
                      Đã có {n.reply_count} tin nhắn trong hội thoại
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && notifications.length > 0 && (
          <div className="p-4 border-t border-charcoal-100">
            <Pagination
              currentPage={page}
              totalPages={paginationInfo.totalPages}
              hasNextPage={paginationInfo.hasNextPage}
              hasPreviousPage={paginationInfo.hasPreviousPage}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal isOpen={!!detailNotif} onClose={() => setDetailNotif(null)} title={detailNotif?.title || 'Thông báo'}>
        {detailNotif && (
          <div className="flex flex-col h-[80vh] md:h-[600px] overflow-hidden">
            <div className="p-5 bg-gradient-to-br from-charcoal-50 to-white border-b border-charcoal-100">
              <span className="text-xs font-medium text-charcoal-500 mb-2 block uppercase tracking-wider">
                Chủ trọ gửi lúc {new Date(detailNotif.created_at).toLocaleString('vi-VN')}
              </span>
              <p className="text-charcoal-900 whitespace-pre-wrap leading-relaxed">{detailNotif.content}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              {replies.length === 0 ? (
                <div className="text-center text-charcoal-400 py-10 text-sm">
                  Bạn có thể gửi câu hỏi hoặc phản hồi lại thông báo này.
                </div>
              ) : (
                replies.map(r => (
                  <div key={r.id} className={`flex ${r.sender_role === 'tenant' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3.5 ${
                      r.sender_role === 'tenant' 
                        ? 'bg-terra-500 text-white rounded-br-sm shadow-sm' 
                        : 'bg-charcoal-100 text-charcoal-900 rounded-bl-sm'
                    }`}>
                      <div className="text-[11px] opacity-75 mb-1.5 flex justify-between gap-4">
                        <span className="font-medium">{r.sender_role === 'tenant' ? 'Bạn' : 'Chủ trọ'}</span>
                        <span>{new Date(r.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-charcoal-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
              <form onSubmit={handleReply} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border border-charcoal-200 bg-charcoal-50 rounded-full px-5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-terra-500 focus:border-terra-500 focus:outline-none transition-all"
                  placeholder="Gửi phản hồi cho chủ trọ..."
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                />
                <Button type="submit" disabled={!replyContent.trim()} className="rounded-full w-11 h-11 p-0 flex items-center justify-center shrink-0">
                  <Send className="w-5 h-5 ml-0.5" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
