import React, { useState, useEffect } from 'react';
import { getNotificationDetail, sendNotification, replyNotification, getAdminUsers, markNotificationAsRead } from '../lib/api';
import { Bell, Send, Users, User, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Pagination } from '../components/common/Pagination';
import { PageSizeSelector } from '../components/common/PageSizeSelector';
import { SearchInput } from '../components/common/SearchInput';

import { Page } from '../types';

export default function NotificationsAdmin({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const [activeTab, setActiveTab] = useState<'personal' | 'all'>('personal');
  const [viewMode, setViewMode] = useState<'main' | 'archive'>('main');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Compose modal
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ title: '', content: '', targetTenantId: '' });
  const [tenants, setTenants] = useState<any[]>([]);
  
  // Detail modal
  const [detailNotif, setDetailNotif] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [paginationInfo, setPaginationInfo] = useState({ totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadNotifications();
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, page, limit]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const isArchive = viewMode === 'archive';
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/notifications/my?archive=${isArchive}&page=${page}&limit=${limit}`, {
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
      setLoading(false);
    }
  }

  async function loadTenants() {
    try {
      const usersRes = await getAdminUsers({ limit: 10000 });
      const usersData = usersRes.data || [];
      setTenants(usersData.filter((u: any) => u.role === 'TENANT' && u.tenant_id));
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    try {
      await sendNotification({
        title: composeData.title,
        content: composeData.content,
        targetType: activeTab,
        targetTenantId: activeTab === 'personal' ? composeData.targetTenantId : undefined
      });
      setIsComposeOpen(false);
      setComposeData({ title: '', content: '', targetTenantId: '' });
      loadNotifications();
      alert('Gửi thông báo thành công');
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi thông báo');
    }
  }

  async function openDetail(n: any) {
    try {
      if (!n.is_read && n.target_type === 'ADMIN') {
        await markNotificationAsRead(n.id);
        setNotifications(prev => prev.map(notif => notif.id === n.id ? {...notif, is_read: 1} : notif));
      }

      if (n.action_url && onNavigate) {
        const targetPage = n.action_url.replace('/', '') as Page;
        onNavigate(targetPage);
        return;
      }

      const detail = await getNotificationDetail(n.id);
      setDetailNotif(detail.notification);
      setReplies(detail.replies);
      setRecipients(detail.recipients);
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
      openDetail(detailNotif);
      loadNotifications();
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi phản hồi');
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm('Xóa thông báo này vào mục lưu trữ?')) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/notifications/${id}`, {
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
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/notifications/${id}/restore`, {
        method: 'PATCH',
        credentials: 'include'
      });
      loadNotifications();
    } catch {
      alert('Lỗi khi khôi phục');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif lining-nums tabular-nums text-charcoal-900 tracking-wide">
            <Bell className="w-6 h-6 text-terra-500" />
            Trung tâm Thông báo
          </h1>
          <p className="text-charcoal-400 mt-2 text-sm">Gửi và quản lý thông báo cho khách thuê</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadNotifications}><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={() => setIsComposeOpen(true)} className="flex items-center gap-2">
            <Send className="w-4 h-4" /> Soạn thông báo mới
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-64">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Tìm thông báo..." />
        </div>
        <PageSizeSelector limit={limit} onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-charcoal-100 p-6">
        <div className="flex items-center justify-between mb-4 border-b border-charcoal-100 pb-2">
          <div className="flex gap-4">
            <button 
              onClick={() => setViewMode('main')}
              className={`pb-2 px-1 font-medium text-sm transition-colors relative ${viewMode === 'main' ? 'text-terra-600' : 'text-charcoal-500 hover:text-charcoal-800'}`}
            >
              Lịch sử gửi (Tối đa 99 tin)
              {viewMode === 'main' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-terra-500 rounded-t-full"></span>}
            </button>
            <button 
              onClick={() => setViewMode('archive')}
              className={`pb-2 px-1 font-medium text-sm transition-colors relative ${viewMode === 'archive' ? 'text-terra-600' : 'text-charcoal-500 hover:text-charcoal-800'}`}
            >
              Lưu trữ (30 ngày)
              {viewMode === 'archive' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-terra-500 rounded-t-full"></span>}
            </button>
          </div>
        </div>
        
        {loading ? (
          <p className="text-charcoal-500 py-4">Đang tải...</p>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 bg-charcoal-50 rounded-xl">
            <Bell className="w-12 h-12 text-charcoal-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-charcoal-900">Chưa có thông báo nào</h3>
            <p className="text-charcoal-500 mt-1">Bấm Soạn thông báo mới để gửi tin đầu tiên.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(n => (
              <div 
                key={n.id} 
                className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-charcoal-100 rounded-xl hover:border-terra-300 transition-colors cursor-pointer"
                onClick={() => openDetail(n)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {n.target_type === 'all' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <Users className="w-3 h-3 mr-1" /> Tất cả
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        <User className="w-3 h-3 mr-1" /> Cá nhân
                      </span>
                    )}
                    <span className="text-xs text-charcoal-400">{new Date(n.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                  <h3 className="font-medium text-charcoal-900">{n.title}</h3>
                  <p className="text-sm text-charcoal-500 line-clamp-1">{n.content}</p>
                </div>
                
                <div className="mt-4 md:mt-0 flex flex-row items-center gap-6">
                  <div className="text-charcoal-500 text-center">
                    <div className="font-medium text-charcoal-900">{n.read_count} / {n.total_recipients}</div>
                    <div className="text-xs">Đã xem</div>
                  </div>
                  <div className="text-charcoal-500 text-center">
                    <div className="font-medium text-charcoal-900">{n.reply_count}</div>
                    <div className="text-xs">Phản hồi</div>
                  </div>
                  <div className="flex flex-col gap-1 border-l pl-4 border-charcoal-100">
                    {viewMode === 'main' ? (
                      <button onClick={(e) => handleDelete(e, n.id)} className="text-xs text-red-500 hover:underline px-2 py-1">Xóa</button>
                    ) : (
                      <button onClick={(e) => handleRestore(e, n.id)} className="text-xs text-terra-600 hover:underline px-2 py-1">Khôi phục</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && notifications.length > 0 && (
          <div className="mt-4">
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

      <Modal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} title="Soạn thông báo">
        <form onSubmit={handleSendNotification} className="p-6 space-y-4">
          <div className="flex gap-4 border-b border-charcoal-100 pb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                checked={activeTab === 'personal'} 
                onChange={() => setActiveTab('personal')}
                className="text-terra-600 focus:ring-terra-500"
              />
              <span className="text-sm font-medium">Gửi Cá nhân</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                checked={activeTab === 'all'} 
                onChange={() => setActiveTab('all')}
                className="text-terra-600 focus:ring-terra-500"
              />
              <span className="text-sm font-medium">Gửi Tất cả</span>
            </label>
          </div>

          {activeTab === 'personal' && (
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">Chọn Khách thuê</label>
              <select 
                className="w-full border border-charcoal-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-terra-500"
                value={composeData.targetTenantId}
                onChange={e => setComposeData({...composeData, targetTenantId: e.target.value})}
                required
              >
                <option value="">-- Chọn khách thuê --</option>
                {tenants.map(t => (
                  <option key={t.tenant_id} value={t.tenant_id}>{t.full_name} ({t.username})</option>
                ))}
              </select>
            </div>
          )}

          <Input 
            label="Tiêu đề thông báo" 
            name="title"
            value={composeData.title}
            onChange={v => setComposeData({...composeData, title: v})}
            required
            placeholder="VD: Nhắc nhở thanh toán..."
          />

          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1">Nội dung</label>
            <textarea
              className="w-full border border-charcoal-200 rounded-xl p-3 focus:ring-2 focus:ring-terra-500 h-32"
              value={composeData.content}
              onChange={e => setComposeData({...composeData, content: e.target.value})}
              required
              placeholder="Nhập nội dung thông báo..."
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsComposeOpen(false)}>Hủy</Button>
            <Button type="submit" className="flex items-center gap-2"><Send className="w-4 h-4"/> Gửi đi</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!detailNotif} onClose={() => setDetailNotif(null)} title={detailNotif?.title || 'Chi tiết thông báo'}>
        {detailNotif && (
          <div className="flex flex-col h-[80vh] md:h-[600px] overflow-hidden">
            <div className="p-4 bg-charcoal-50 border-b border-charcoal-100">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-charcoal-500 block mb-1">
                    Gửi lúc {new Date(detailNotif.created_at).toLocaleString('vi-VN')}
                  </span>
                  <p className="text-charcoal-800 font-medium">{detailNotif.content}</p>
                </div>
              </div>
              
              <div className="mt-3 text-xs text-charcoal-500 pt-2 border-t border-charcoal-200/50">
                <strong>Người nhận:</strong> {detailNotif.target_type === 'all' ? 'Tất cả khách thuê' : recipients.map(r => r.ho_ten).join(', ')}
                {detailNotif.target_type === 'all' && (
                  <span className="ml-2 bg-white px-2 py-0.5 rounded border border-charcoal-200">
                    {recipients.filter(r => r.is_read).length} / {recipients.length} đã xem
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              {replies.length === 0 ? (
                <div className="text-center text-charcoal-400 py-8 text-sm">Chưa có phản hồi nào.</div>
              ) : (
                replies.map(r => (
                  <div key={r.id} className={`flex ${r.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl p-3 ${
                      r.sender_role === 'admin' 
                        ? 'bg-terra-500 text-white rounded-br-none' 
                        : 'bg-charcoal-100 text-charcoal-800 rounded-bl-none'
                    }`}>
                      <div className="text-xs opacity-70 mb-1 flex justify-between gap-4">
                        <span>{r.sender_role === 'admin' ? 'Bạn' : 'Khách thuê'}</span>
                        <span>{new Date(r.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{r.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-charcoal-100 bg-white">
              <form onSubmit={handleReply} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border border-charcoal-200 rounded-full px-4 py-2 focus:ring-2 focus:ring-terra-500 focus:outline-none"
                  placeholder="Nhập câu trả lời..."
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                />
                <Button type="submit" disabled={!replyContent.trim()} className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
                  <Send className="w-4 h-4 ml-1" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
