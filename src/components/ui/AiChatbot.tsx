import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { sendAiMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';

export function AiChatbot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'ai'; content: string }[]>([
    {
      id: '1',
      role: 'ai',
      content: user?.role === 'LANDLORD' 
        ? 'Xin chào Chủ nhà! Tôi có thể giúp gì cho bạn hôm nay? (VD: Hướng dẫn quản lý khách thuê, thống kê phòng...)'
        : 'Xin chào! Tôi là trợ lý ảo HostelMate. Bạn muốn tìm phòng hay cần hỗ trợ gì ạ?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!user) return null;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendAiMessage(userMessage.content, user.role, user.tenant_id, historyForApi);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: res.reply }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: error.message || 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau nhé!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-terra-600 text-white rounded-full shadow-lg hover:bg-terra-700 transition-all duration-300 flex items-center justify-center z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100 hover:shadow-xl hover:-translate-y-1'}`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl border border-charcoal-100 flex flex-col overflow-hidden transition-all duration-300 z-50 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-terra-600 to-terra-500 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight">Trợ lý AI HostelMate</h3>
              <p className="text-white/80 text-xs">Trực tuyến</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-charcoal-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-terra-100 text-terra-600' : 'bg-charcoal-100 text-charcoal-600'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-terra-500 text-white rounded-tr-sm' : 'bg-white border border-charcoal-100 shadow-sm rounded-tl-sm text-charcoal-800'}`}>
                <div className="text-sm prose prose-sm prose-p:leading-relaxed prose-pre:bg-charcoal-900 prose-pre:text-white max-w-none">
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-charcoal-100 text-charcoal-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 bg-white border border-charcoal-100 shadow-sm rounded-2xl rounded-tl-sm text-charcoal-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang suy nghĩ...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-charcoal-100">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi..."
              className="flex-1 bg-charcoal-50 border border-charcoal-200 text-charcoal-900 text-sm rounded-full px-4 py-3 focus:ring-terra-400 focus:border-terra-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 bg-terra-600 text-white rounded-full flex items-center justify-center hover:bg-terra-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
