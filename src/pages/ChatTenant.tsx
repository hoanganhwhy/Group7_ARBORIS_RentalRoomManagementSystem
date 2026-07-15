import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getChatMessages, sendChatMessage, deleteChatMessage, getFriends, sendFriendRequest, respondFriendRequest } from '../lib/api';
import { MessageCircle, Send, Trash2, Users, MapPin, Search, UserPlus, Check, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useSocket } from '../hooks/useSocket';

export function ChatTenant() {
  const [activeTab, setActiveTab] = useState<'personal' | 'group_ALL' | string>('personal');
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myArea, setMyArea] = useState<string | null>(null);
  
  const [friends, setFriends] = useState<any[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendPage, setFriendPage] = useState(1);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addPhone, setAddPhone] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  useEffect(() => {
    loadMyArea();
    loadFriends();
  }, []);

  useEffect(() => {
    loadMessages();
    
    if (socket) {
      const handleChatMessage = () => loadMessages(false);
      const handleFriendUpdate = () => loadFriends();
      
      socket.on('chat_message', handleChatMessage);
      socket.on('friend_update', handleFriendUpdate);
      return () => {
        socket.off('chat_message', handleChatMessage);
        socket.off('friend_update', handleFriendUpdate);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, socket]);

  const loadMyArea = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/chat/my-area`, {
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

  const loadFriends = async () => {
    try {
      const data = await getFriends();
      setFriends(data);
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
      let receiverId = undefined;
      if (isGroup) {
        receiverId = activeTab.replace('group_', '');
      } else if (activeTab.startsWith('friend_')) {
        receiverId = activeTab.replace('friend_', '');
      }
      
      const result = await getChatMessages(isGroup, false, receiverId === 'ALL' ? undefined : receiverId, { limit: 100 });
      setMessages(result.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const isGroup = activeTab.startsWith('group_');
      let receiverId = undefined;
      if (isGroup) {
        receiverId = activeTab.replace('group_', '');
      } else if (activeTab.startsWith('friend_')) {
        receiverId = activeTab.replace('friend_', '');
      }
      
      await sendChatMessage(content, isGroup, receiverId === 'ALL' ? undefined : receiverId);
      setContent('');
      loadMessages(false);
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi tin nhắn');
    } finally {
      setSending(false);
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

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPhone.trim()) return;
    try {
      await sendFriendRequest(addPhone);
      alert('Đã gửi lời mời kết bạn');
      setAddPhone('');
      setShowAddFriend(false);
      loadFriends();
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi kết bạn');
    }
  };

  const handleRespondRequest = async (id: string, action: 'accept' | 'reject') => {
    try {
      await respondFriendRequest(id, action);
      loadFriends();
    } catch (err: any) {
      alert(err.message || 'Lỗi phản hồi kết bạn');
    }
  };

  // Pagination and Filtering logic
  const friendsPerPage = 10;
  const filteredFriends = useMemo(() => {
    let list = friends.filter(f => f.trang_thai === 'accepted');
    if (friendSearch) {
      list = list.filter(f => f.ho_ten?.toLowerCase().includes(friendSearch.toLowerCase()) || f.so_dien_thoai?.includes(friendSearch));
    }
    return list.sort((a, b) => (a.ho_ten || '').localeCompare(b.ho_ten || ''));
  }, [friends, friendSearch]);

  const totalPages = Math.ceil(filteredFriends.length / friendsPerPage);
  const currentFriends = filteredFriends.slice((friendPage - 1) * friendsPerPage, friendPage * friendsPerPage);

  const pendingIncoming = friends.filter(f => f.trang_thai === 'pending' && f.nguoi_gui_id !== f.tenant_id);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-charcoal-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-charcoal-100 bg-charcoal-50 flex flex-col">
        <div className="p-4 border-b border-charcoal-100 flex items-center justify-between">
          <h2 className="font-semibold text-charcoal-900">Danh bạ Chat</h2>
          <button 
            onClick={() => setShowAddFriend(true)}
            className="p-1.5 bg-terra-100 text-terra-700 rounded-lg hover:bg-terra-200 transition-colors"
            title="Thêm bạn bè"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
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

            {/* Friend Requests */}
            {pendingIncoming.length > 0 && (
              <>
                <div className="pt-4 pb-2 px-3 text-xs font-semibold text-charcoal-400 uppercase tracking-wider flex justify-between">
                  <span>Lời mời kết bạn</span>
                  <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{pendingIncoming.length}</span>
                </div>
                {pendingIncoming.map(req => (
                  <div key={req.request_id} className="mx-2 px-3 py-2 bg-white rounded-xl border border-charcoal-100 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-charcoal-100 flex items-center justify-center text-xs font-medium">
                        {(req.ho_ten || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-charcoal-900 truncate">{req.ho_ten}</div>
                        <div className="text-xs text-charcoal-500 truncate">{req.so_dien_thoai}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRespondRequest(req.request_id, 'accept')} className="flex-1 bg-terra-500 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-terra-600 transition-colors flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" /> Chấp nhận
                      </button>
                      <button onClick={() => handleRespondRequest(req.request_id, 'reject')} className="flex-1 bg-charcoal-100 text-charcoal-700 py-1.5 rounded-lg text-xs font-medium hover:bg-charcoal-200 transition-colors flex items-center justify-center gap-1">
                        <X className="w-3 h-3" /> Từ chối
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Friends List */}
            <div className="pt-4 pb-2 px-3 text-xs font-semibold text-charcoal-400 uppercase tracking-wider">Bạn bè ({filteredFriends.length})</div>
            
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={friendSearch}
                  onChange={e => {
                    setFriendSearch(e.target.value);
                    setFriendPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-charcoal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terra-500"
                />
              </div>
            </div>

            {currentFriends.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-charcoal-400 italic">
                Không tìm thấy bạn bè
              </div>
            ) : (
              currentFriends.map(f => (
                <button 
                  key={f.tenant_id}
                  onClick={() => setActiveTab(`friend_${f.tenant_id}`)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === `friend_${f.tenant_id}` ? 'bg-terra-100 text-terra-700 font-medium' : 'hover:bg-charcoal-100/50 text-charcoal-700'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-charcoal-200 flex items-center justify-center text-charcoal-600 font-medium text-xs flex-shrink-0">
                    {(f.ho_ten || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.ho_ten}</div>
                    <div className="text-[10px] opacity-70 truncate">{f.so_dien_thoai}</div>
                  </div>
                </button>
              ))
            )}

            {totalPages > 1 && (
              <div className="flex justify-between items-center px-4 py-2 mt-2 border-t border-charcoal-100/50">
                <button 
                  onClick={() => setFriendPage(p => Math.max(1, p - 1))}
                  disabled={friendPage === 1}
                  className="text-xs font-medium text-terra-600 disabled:opacity-30 p-1"
                >
                  Trước
                </button>
                <span className="text-[10px] text-charcoal-500">Trang {friendPage}/{totalPages}</span>
                <button 
                  onClick={() => setFriendPage(p => Math.min(totalPages, p + 1))}
                  disabled={friendPage === totalPages}
                  className="text-xs font-medium text-terra-600 disabled:opacity-30 p-1"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 bg-white">
          <h2 className="text-lg font-semibold text-charcoal-900">
            {activeTab === 'personal' ? 'Trò chuyện với Chủ trọ' : 
             activeTab === 'group_ALL' ? 'Phòng Chat Tất Cả Khu Trọ' : 
             activeTab.startsWith('group_') ? `Phòng Chat Khu ${myArea}` :
             `Trò chuyện: ${friends.find(f => f.tenant_id === activeTab.replace('friend_', ''))?.ho_ten || 'Bạn bè'}`
            }
          </h2>
          <p className="text-xs text-charcoal-500">
            {activeTab === 'personal' ? 'Phản hồi, hỏi đáp trực tiếp' : 
             activeTab.startsWith('group_') ? 'Mọi người trong khu vực đều có thể xem và nhắn' :
             'Cuộc trò chuyện riêng tư'}
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
              let mineCheck = false;
              if (activeTab.startsWith('friend_')) {
                mineCheck = msg.sender_id !== activeTab.replace('friend_', '');
              } else {
                mineCheck = msg.sender_role === 'TENANT';
              }

              return (
                <div key={msg.id} className={`flex ${mineCheck ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[70%] ${mineCheck ? 'order-2' : 'order-1'}`}>
                    {!mineCheck && activeTab.startsWith('group_') && (
                      <div className="text-xs text-charcoal-500 mb-1 ml-1">{msg.sender_name || 'Admin'}</div>
                    )}
                    <div className={`relative px-4 py-2.5 rounded-2xl ${mineCheck ? 'bg-terra-500 text-white rounded-tr-sm' : 'bg-charcoal-100 text-charcoal-900 rounded-tl-sm'} ${msg.is_deleted ? 'opacity-70 bg-opacity-50' : ''}`}>
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                        {msg.is_deleted ? <span className="italic">Tin nhắn đã thu hồi</span> : msg.content}
                      </p>
                      <div className={`text-[10px] mt-1.5 flex items-center justify-between gap-2 ${mineCheck ? 'text-terra-100' : 'text-charcoal-400'}`}>
                        <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        {mineCheck && !msg.is_deleted && (
                          <span className="font-medium opacity-90">
                            {activeTab.startsWith('group_') ? 'Đã gửi' : (msg.is_read ? 'Đã xem' : 'Đã gửi')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!msg.is_deleted && (
                    <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity ${mineCheck ? 'order-1 pr-2' : 'order-2 pl-2'}`}>
                      <button onClick={() => handleDelete(msg.id)} className="p-1.5 text-charcoal-400 hover:text-red-500 rounded-full hover:bg-red-50" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
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
          <button
            type="submit"
            disabled={!content.trim() || sending}
            className="w-[52px] h-[52px] flex items-center justify-center bg-terra-500 text-white rounded-2xl hover:bg-terra-600 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-charcoal-900">Thêm bạn bè</h3>
              <button onClick={() => setShowAddFriend(false)} className="p-2 hover:bg-charcoal-50 rounded-full transition-colors text-charcoal-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddFriend} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Số điện thoại</label>
                <input
                  type="tel"
                  value={addPhone}
                  onChange={e => setAddPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-terra-500 focus:border-terra-500 outline-none"
                  placeholder="Nhập SĐT..."
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAddFriend(false)}>Hủy</Button>
                <Button type="submit" variant="primary" className="flex-1">Gửi lời mời</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
