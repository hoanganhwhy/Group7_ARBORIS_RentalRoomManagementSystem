import React, { useState, useEffect, useRef } from 'react';
import { getChatMessages, sendChatMessage, deleteChatMessage, getAdminUsers } from '../lib/api';
import { MessageCircle, Send, Trash2, Users, MapPin } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function ChatTenant() {
  const [activeTab, setActiveTab] = useState<'personal' | 'group_ALL' | string>('personal');
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [myArea, setMyArea] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMyArea();
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => {
      loadMessages(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadMyArea = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/chat/my-area`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setMyArea(data.area);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function loadMessages(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const isGroup = activeTab.startsWith('group_');
      const receiverId = isGroup ? activeTab.replace('group_', '') : undefined;
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
      const receiverId = isGroup ? activeTab.replace('group_', '') : undefined;
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

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-charcoal-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-charcoal-100 bg-charcoal-50 flex flex-col">
        <div className="p-4 border-b border-charcoal-100">
          <h2 className="font-semibold text-charcoal-900">Danh bạ Chat</h2>
        </div>
        <div className="p-2 space-y-1">
          <button 
            onClick={() => setActiveTab('personal')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'personal' ? 'bg-terra-100 text-terra-700 font-medium' : 'hover:bg-charcoal-100/50 text-charcoal-700'}`}
          >
            <MessageCircle className="w-5 h-5" />
            Nhắn với Chủ trọ
          </button>
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-charcoal-400 uppercase tracking-wider">Chat Tập Thể</div>
          
          <button 
            onClick={() => setActiveTab('group_ALL')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'group_ALL' ? 'bg-terra-100 text-terra-700 font-medium' : 'hover:bg-charcoal-100/50 text-charcoal-700'}`}
          >
            <Users className="w-5 h-5" />
            Tất cả khu trọ
          </button>

          {myArea && (
            <button 
              onClick={() => setActiveTab(`group_${myArea}`)}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === `group_${myArea}` ? 'bg-terra-100 text-terra-700 font-medium' : 'hover:bg-charcoal-100/50 text-charcoal-700'}`}
            >
              <MapPin className="w-5 h-5" />
              Khu {myArea}
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 bg-white">
          <h2 className="text-lg font-semibold text-charcoal-900">
            {activeTab === 'personal' ? 'Trò chuyện với Chủ trọ' : activeTab === 'group_ALL' ? 'Phòng Chat Tất Cả Khu Trọ' : `Phòng Chat Khu ${myArea}`}
          </h2>
          <p className="text-xs text-charcoal-500">
            {activeTab === 'personal' ? 'Phản hồi, hỏi đáp trực tiếp' : 'Mọi người trong khu vực đều có thể xem và nhắn'}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-terra-500 border-t-transparent rounded-full"></div></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-charcoal-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              Chưa có tin nhắn nào. Bắt đầu trò chuyện ngay!
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_role === 'TENANT';
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[70%] ${isMine ? 'order-2' : 'order-1'}`}>
                    {!isMine && activeTab.startsWith('group_') && (
                      <div className="text-xs text-charcoal-500 mb-1 ml-1">{msg.sender_name || 'Admin'}</div>
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
        {activeTab !== 'group_ALL' ? (
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
        ) : (
          <div className="p-4 bg-charcoal-50 border-t border-charcoal-100 text-center text-sm text-charcoal-500">
            Chỉ Chủ trọ (Admin) mới có quyền gửi tin nhắn trong Nhóm Tất cả khu trọ.
          </div>
        )}
      </div>
    </div>
  );
}
