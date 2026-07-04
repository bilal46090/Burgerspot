
import React, { useState, useEffect } from 'react';
import { 
  generateSmartResponse, 
  detectAppIssues, 
  autoFixIssue,
  Issue 
} from '../services/AITrainer';
import { getTodaySales, getLowStockItems, getPendingOrders } from '../services/database';
import { askAnything } from '../services/AIManager';

const AIConsultant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([
    { 
      role: 'ai', 
      content: '🤖 **Bursport AI Consultant**\n\nMain aapka personal assistant hoon!\n\n✅ **Mai kya kar sakta hoon:**\n• App issues detect karna\n• Solutions suggest karna\n• Auto-fix karna\n• Business mashware dena\n\n💬 Kuch bhi poochiye! Jaise:\n• "Error aa raha hai"\n• "Aaj ki sale btao"\n• "Kya issue hai app mein?"\n• "Fix it"' 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [detectedIssues, setDetectedIssues] = useState<Issue[]>([]);

  // Auto-detect issues on load
  useEffect(() => {
    checkAppHealth();
  }, []);

  const checkAppHealth = async () => {
    const issues = await detectAppIssues();
    setDetectedIssues(issues);
    
    if (issues.length > 0) {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `⚠️ **${issues.length} issue(s) detected in your app!**\n\n${issues.map(i => `• ${i.title}`).join('\n')}\n\nType "check issues" for details or "fix all" to auto-resolve.`
      }]);
    } else {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: '✅ **App health check passed!** No issues detected. Your app is running smoothly.'
      }]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    
    // Prepare context
    const context = {
      totalSales: await getTodaySales(),
      pendingOrders: await getPendingOrders(),
      lowStock: await getLowStockItems()
    };
    
    // Generate smart response
    const { response, actions } = await generateSmartResponse(input, context);
    
    let finalResponse = response;
    
    // Handle auto-fix actions
    if (input.toLowerCase().includes('fix all') && detectedIssues.length > 0) {
      let fixResults = '';
      for (const issue of detectedIssues) {
        const result = await autoFixIssue(issue);
        fixResults += `\n${result.message}`;
      }
      finalResponse = `🔧 **Auto-fix executed:**${fixResults}\n\n${response || 'Issues resolved if possible.'}`;
    }
    
    if (!finalResponse) {
        // Fallback or use AIManager
        try {
          // Convert current messages to history format
          const history = messages
            .filter(m => m.content !== 'Thinking...')
            .map(m => ({ role: m.role, content: m.content }));
          
          finalResponse = await askAnything(input, history);
        } catch (err) {
          finalResponse = "Maaf kijiye, abhi main iska jawab nahi de pa raha hoon.";
        }
    }

    setMessages(prev => [...prev, { role: 'ai', content: finalResponse || 'Processing...' }]);
    setLoading(false);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-36 z-[9999]">
           <button 
             onClick={() => setIsOpen(true)}
             className="flex items-center gap-2 p-3 bg-emerald-500 text-white rounded-2xl shadow-xl hover:bg-emerald-600 transition-all active:scale-95 border-2 border-white/20"
           >
             <span className="text-xl">🤖</span>
             <div className="text-left">
               <p className="text-[7px] font-black uppercase tracking-tighter leading-none opacity-80">Consultant</p>
               <p className="text-[10px] font-black uppercase leading-none">AI Help</p>
             </div>
           </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[400px] sm:w-[450px] h-[600px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 z-[9999]">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
            <div>
              <h3 className="font-bold">🤖 AI Consultant</h3>
              <p className="text-xs opacity-80 uppercase tracking-widest text-[9px] font-black">Diagnostic • Solutions • Auto-fix</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-lg">
              <span className="text-2xl leading-none">×</span>
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-100 dark:bg-slate-800 dark:text-white'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Health Status */}
          {detectedIssues.length > 0 && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200">
              <p className="text-xs text-red-600 font-bold uppercase tracking-widest text-[9px]">⚠️ {detectedIssues.length} issue(s) active</p>
            </div>
          )}
          
          {/* Input */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type 'error', 'check issues', 'fix it'..."
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-emerald-500 dark:text-white text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                className="bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors font-bold text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIConsultant;
