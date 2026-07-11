import React, { useState, useEffect, useRef } from 'react';
import { getChatMessages, sendChatMessage, deleteChatMessage, getAdminUsers, getRooms } from '../lib/api';
import { MessageCircle, Send, Trash2, Users, Search, MapPin } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function ChatAdmin() {
  const [activeTab, setActiveTab] = useState<'group' | string>('group_ALL');
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<any[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTenants();
    loadAreas();
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => {
      loadMessages(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function loadTenants() {
    try {
      const usersData = await getAdminUsers();
      setTenants(usersData.filter((u: any) => u.role === 'TENANT' && u.tenant_id));
    } catch (error) {
      console.error(error);
    }
  }

  async function loadAreas() {
    try {
      const roomsData = await getRooms();
      const uniqueAreas = Array.from(new Set(roomsData.map((r: any) => r.area).filter(Boolean))) as string[];
      setAreas(uniqueAreas);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadMessages(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const isGroup = activeTab.startsWith('group_');
      const receiverId = isGroup ? activeTab.replace('group_', '') : activeTab;
      const data = await getChatMessages(isGroup, false, receiverId === 'ALL' ? undefined : receiverId);
      setMessages(data);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      const isGroup = activeTab.startsWith('group_');
      const receiverId = isGroup ? activeTab.replace('group_', '') : activeTab;
      await sendChatMessage(content, isGroup, receiverId === 'ALL' ? undefined : receiverId);
      setContent('');
      loadMessages(false);
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi tin nhắn');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Xóa tin nhắn này? Tin nhắn sẽ được chuyển vào mục lưu trữ.')) return;
    try {
      await deleteChatMessage(id);
      loadMessages(false);
    } catch (error: any) {
      alert(error.message || 'Lỗi khi xóa tin nhắn');
    }
  }

  const filteredTenants = tenants.filter(t => 
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeTenant = tenants.find(t => t.tenant_id === activeTab);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-charcoal-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-charcoal-100 bg-charcoal-50 flex flex-col">
        <div className="p-4 border-b border-charcoal-100">
          <h2 className="font-semibold text-charcoal-900 mb-4">Danh bạ Chat</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
            <input 
              type="text" 
              placeholder="Tìm khách thuê..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-charcoal-200 bg-white focus:outline-none focus:ring-2 focus:ring-terra-500 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="pt-2 pb-1 px-3 text-xs font-semibold text-charcoal-400 uppercase tracking-wider">Chat Tập Thể</div>
          <button 
            onClick={() => setActiveTab('group_ALL')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'group_ALL' ? 'bg-terra-100 text-terra-700 font-medium' : 'hover:bg-charcoal-100/50 text-charcoal-700'}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeTab === 'group_ALL' ? 'bg-terra-200 text-terra-700' : 'bg-charcoal-200 text-charcoal-500'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-medium">Tất cả khu trọ</div>
              <div className="text-xs opacity-80">Phòng chat tổng</div>
            </div>
          </button>

          {areas.map(area => (
            <button 
              key={`group_${area}`}
              onClick={() => setActiveTab(`group_${area}`)}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === `group_${area}` ? 'bg-terra-100 text-terra-700 font-medium' : 'hover:bg-charcoal-100/50 text-charcoal-700'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeTab === `group_${area}` ? 'bg-terra-200 text-terra-700' : 'bg-charcoal-200 text-charcoal-500'}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium">{area}</div>
                <div className="text-xs opacity-80">Chat nhóm khu vực</div>
              </div>
            </button>
          ))}

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-charcoal-400 uppercase tracking-wider">Khách Thuê (1-1)</div>
          
          {filteredTenants.map(t => (
            <button 
              key={t.tenant_id}
              onClick={() => setActiveTab(t.tenant_id)}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors ${activeTab === t.tenant_id ? 'bg-terra-100 text-terra-700 font-medium' : 'hover:bg-charcoal-100/50 text-charcoal-700'}`}
            >
              <div className="w-10 h-10 rounded-full bg-terra-50 text-terra-600 flex items-center justify-center font-bold border border-terra-100">
                {t.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 truncate">
                <div className="font-medium text-sm truncate">{t.full_name || t.username}</div>
                <div className="text-xs opacity-70 truncate">{t.phone || 'Chưa cập nhật'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-terra-50 text-terra-600 flex items-center justify-center font-bold border border-terra-100">
            {activeTab.startsWith('group_') ? (activeTab === 'group_ALL' ? <Users className="w-6 h-6" /> : <MapPin className="w-6 h-6" />) : (activeTenant?.full_name?.charAt(0) || 'U')}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-charcoal-900">
              {activeTab === 'group_ALL' ? 'Phòng Chat Tất Cả Khu Trọ' : activeTab.startsWith('group_') ? `Phòng Chat ${activeTab.replace('group_', '')}` : (activeTenant?.full_name || 'Đang tải...')}
            </h2>
            <p className="text-xs text-charcoal-500">
              {activeTab.startsWith('group_') ? 'Tất cả mọi người trong nhóm đều có thể nhắn tin' : (activeTenant?.phone ? `SĐT: ${activeTenant.phone}` : 'Tin nhắn riêng')}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-terra-500 border-t-transparent rounded-full"></div></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-charcoal-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              Chưa có tin nhắn nào. Gửi lời chào để bắt đầu!
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_role === 'ADMIN';
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[70%] ${isMine ? 'order-2' : 'order-1'}`}>
                    {!isMine && activeTab.startsWith('group_') && (
                      <div className="text-xs text-charcoal-500 mb-1 ml-1">{msg.sender_name || 'Khách'}</div>
                    )}
                    <div className={`relative px-4 py-2.5 rounded-2xl ${isMine ? 'bg-terra-500 text-white rounded-tr-sm' : 'bg-charcoal-100 text-charcoal-900 rounded-tl-sm'}`}>
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                      <div className={`text-[10px] mt-1.5 flex items-center justify-between gap-2 ${isMine ? 'text-terra-100' : 'text-charcoal-400'}`}>
                        <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMine && (
                          <span className="font-medium opacity-90">
                            {activeTab.startsWith('group_') ? 'Đã gửi' : (msg.is_read ? 'Đã xem' : 'Đã gửi')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'order-1 pr-2' : 'order-2 pl-2'}`}>
                    <button onClick={() => handleDelete(msg.id)} className="p-1.5 text-charcoal-400 hover:text-red-500 rounded-full hover:bg-red-50" title="Xóa">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-charcoal-100 flex items-end gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-charcoal-50 border border-charcoal-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-terra-500 focus:border-transparent resize-none h-[52px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <Button type="submit" className="h-[52px] px-6 rounded-2xl flex-shrink-0" disabled={!content.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
