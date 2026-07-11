import React, { useState, useEffect } from 'react';
import { getNotifications, getNotificationDetail, sendNotification, replyNotification, getAdminUsers } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Bell, Send, Users, User, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Badge, Spinner, EmptyState } from '../components/ui/Input';

export default function NotificationsAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'personal' | 'all'>('personal');
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

  useEffect(() => {
    loadNotifications();
    loadTenants();
  }, []);

  async function loadNotifications() {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTenants() {
    try {
      const usersData = await getAdminUsers();
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

  async function openDetail(id: number) {
    try {
      const detail = await getNotificationDetail(id);
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
      openDetail(detailNotif.id);
      loadNotifications();
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi phản hồi');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-terra-500" />
            Trung tâm Thông báo
          </h1>
          <p className="text-charcoal-500 mt-1 text-sm">Gửi và quản lý thông báo cho khách thuê</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadNotifications}><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={() => setIsComposeOpen(true)} className="flex items-center gap-2">
            <Send className="w-4 h-4" /> Soạn thông báo mới
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-charcoal-100 p-6">
        <h2 className="text-lg font-semibold text-charcoal-900 mb-4">Lịch sử gửi thông báo</h2>
        
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
                onClick={() => openDetail(n.id)}
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
                  <div className="text-charcoal-500 text-center min-w-[60px]">
                    <div className="font-medium text-terra-600 flex items-center justify-center gap-1">
                      <MessageCircle className="w-4 h-4" /> {n.reply_count}
                    </div>
                    <div className="text-xs">Phản hồi</div>
                  </div>
                </div>
              </div>
            ))}
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
