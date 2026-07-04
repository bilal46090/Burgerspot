import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Zap } from 'lucide-react';
import { askGeminiFast, preFetchCommonQueries, clearCache } from '../services/AIManager';

interface Message {
  role: 'user' | 'ai';
  content: string;
  isStreaming?: boolean;
}

const GeminiChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Assalam-o-Alaikum! Main Bursport AI hoon. 📊\n\nMujhse aaj ya kal ki sale ke baare mein poocho:\n• "Aaj ki total sale kitni hai?"\n• "Udhaar balance kitna hai?"\n• "Sabse zyada kya bik raha hai?"\n\n⚡ Main ab bilkul live data aur Market Udhaar bhi dekh sakta hoon!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pre-fetch common queries when chat opens
  useEffect(() => {
    if (isOpen) {
      preFetchCommonQueries();
    }
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async (queryText?: string | any) => {
    const textToUse = typeof queryText === 'string' ? queryText : input;
    const userQuery = textToUse.trim();
    if (!userQuery || loading) return;
    
    setMessages(prev => [...prev, { role: 'user' as const, content: userQuery }]);
    setInput('');
    setLoading(true);
    
    // Add placeholder for AI response
    setMessages(prev => [...prev, { role: 'ai', content: '...', isStreaming: true }]);
    
    try {
      const startTime = Date.now();
      // Pass the last few messages for conversation context (excluding the placeholder)
      const chatHistory = messages.filter(m => m.content !== '...').slice(-6);
      const answer = await askGeminiFast(userQuery, chatHistory);
      const elapsed = Date.now() - startTime;
      
      // Replace placeholder with actual answer
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'ai') {
          const newArray = [...prev];
          newArray[newArray.length - 1] = {
            ...lastMsg,
            content: answer + `\n\n⚡ (${(elapsed/1000).toFixed(1)}s)`,
            isStreaming: false
          };
          return newArray;
        }
        return prev;
      });
      
    } catch (error) {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'ai') {
          const newArray = [...prev];
          newArray[newArray.length - 1] = {
            ...lastMsg,
            content: '❌ Maaf kijiye, error aa gaya. Dobara try karein.',
            isStreaming: false
          };
          return newArray;
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{ 
      role: 'ai', 
      content: 'Chat cleared! Kuch bhi poocho — main fast jawab dunga! ⚡' 
    }]);
    clearCache();
  };

  // Suggested questions
  const suggestions = [
    { text: "📊 Aaj ki sale", query: "Aaj ki sale?" },
    { text: "💳 Udhaar Total", query: "Bazaar ka total udhaar (credit) kitna hai aur kis ne dena hai?" },
    { text: "📦 Stock check", query: "Kya koi item low stock hai?" },
    { text: "🏆 Top item", query: "Sabse zyada kya bik raha hai?" },
  ];

  return (
    <>
      {/* Floating Button (Updated to match Target Guest style) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <motion.div
            drag
            dragMomentum={false}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="cursor-pointer"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="group relative flex items-center gap-2 p-2 pr-4 bg-white/60 dark:bg-slate-800/20 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl transition-all hover:bg-white/80 active:shadow-inner"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                  <Zap size={18} strokeWidth={3} />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm animate-pulse" />
              </div>
              <div className="text-left pr-1">
                <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 italic">
                  AI Manager
                </p>
                <p className="text-[11px] italic text-slate-900 dark:text-white font-black truncate leading-tight">
                   Ask Gemini
                </p>
              </div>
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-24 right-6 w-[380px] sm:w-[400px] h-[550px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-bold leading-tight">Bursport AI</h3>
                  <p className="text-[10px] opacity-90 flex items-center gap-1 uppercase tracking-wider">
                    <Zap size={10} /> Fast Mode • Live Data
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={clearChat} className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded hover:bg-white/30 uppercase">
                  Reset
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-amber-500 text-white rounded-2xl rounded-tr-none' 
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.isStreaming && (
                      <div className="flex gap-1 mt-2">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-75" />
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce delay-150" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      sendMessage(s.query);
                    }}
                    className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-amber-100 dark:hover:bg-amber-900/30 transition border border-slate-200 dark:border-slate-700"
                  >
                    {s.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Kuch bhi poocho..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-3 rounded-xl hover:shadow-lg transition disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GeminiChat;
