"use client";


import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Trash2, Copy, Wand2, Languages, BookOpen } from 'lucide-react';


async function getAIConsultantResponse(input: string): Promise<string> {
  return `（AI占位回复）我已收到：\n\n下一步建议：\n- 明确客户需求\n- 补充关键背景信息\n- 给出2-3个可选方案`;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIWorkspace: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '您好！我是柯维AI助手。我可以帮您润色文书、提供选校方案或回答最新的留学政策。请告诉我您需要什么帮助？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const response = await getAIConsultantResponse(input);
    const assistantMessage: ChatMessage = { role: 'assistant', content: response || "抱歉，由于网络波动，我暂时无法回应。" };
    
    setMessages(prev => [...prev, assistantMessage]);
    setLoading(false);
  };

  const handleQuickAction = (action: string) => {
    let prompt = "";
    switch(action) {
      case 'polish': prompt = "请帮我润色以下这段文书，让表达更地道、更具说服力：\n"; break;
      case 'schools': prompt = "请根据以下学生背景，推荐5所适合申请的大学：\n"; break;
      case 'translate': prompt = "请将以下内容翻译成优美的学术英语：\n"; break;
    }
    setInput(prompt);
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-12rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-blue-600" />
            AI 文书助手
          </h2>
          <p className="text-gray-500">基于 Gemini 3 Pro 的专业留学咨询助手</p>
        </div>
        <button 
          onClick={() => setMessages([messages[0]])}
          className="text-gray-400 hover:text-red-500 p-2 rounded-lg transition-colors"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        {/* Quick Actions */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex gap-2 overflow-x-auto">
          <button 
            onClick={() => handleQuickAction('polish')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
          >
            <Wand2 size={14} /> 润色文书
          </button>
          <button 
            onClick={() => handleQuickAction('schools')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
          >
            <BookOpen size={14} /> 推荐选校
          </button>
          <button 
            onClick={() => handleQuickAction('translate')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
          >
            <Languages size={14} /> 专业翻译
          </button>
        </div>

        {/* Chat History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-600'
                }`}>
                  {msg.role === 'user' ? '我' : <Sparkles size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-50' 
                    : 'bg-gray-50 text-gray-800'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && idx > 0 && (
                    <button 
                      onClick={() => navigator.clipboard.writeText(msg.content)}
                      className="mt-3 text-xs flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Copy size={12} /> 复制回复内容
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-blue-300">
                  <Sparkles size={16} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl w-24 h-12"></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入您的需求，例如：请帮我修改这篇哈佛大学的PS..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-24"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={`absolute right-3 bottom-3 p-2 rounded-lg transition-all ${
                input.trim() && !loading 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center uppercase tracking-wider">
            由柯维智库 AI 提供强力支持 • 生成内容仅供参考
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIWorkspace;
