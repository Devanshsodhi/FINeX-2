import React, { useState, useEffect, useRef } from 'react';
import {
  Menu, X, MessageSquare, Mic, Send, Zap, Plus, Edit2,
  Languages, LayoutTemplate, ChevronRight, Brain, Database,
  GraduationCap, Bot, Plug
} from 'lucide-react';
import axios from 'axios';
import { ConversationHistory, streamMessage, getMemories, clearMemory, storeFact, deleteMemory } from '@llm/index.js';

const DashboardView = ({ user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState([]);
  const [message, setMessage] = useState('');
  const [activeChat, setActiveChat] = useState(1);
  const [chatMessages, setChatMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const userId = user?.email || 'unknown';
  const sessionId = useRef(crypto.randomUUID()).current;
  const historyRef = useRef(new ConversationHistory(user, userId));
  const chatBottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const rafRef = useRef(null);
  const pendingFullRef = useRef('');

  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [memories, setMemories] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [activeSkill, setActiveSkill] = useState(null); // { id, name } when a skill is running
  const [skillsRegistry, setSkillsRegistry] = useState([]);
  const [agentsRegistry, setAgentsRegistry] = useState([]);
  const [connectorsRegistry, setConnectorsRegistry] = useState([]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await axios.get('/api/chats');
        setChats(response.data);
      } catch (err) {
        setChats([
          { id: 1, title: 'Investment strategies 2024' },
          { id: 2, title: 'How to save money' },
          { id: 3, title: 'React vs Next.js' }
        ]);
      }
    };
    fetchChats();
  }, []);

  useEffect(() => {
    if (chatMessages.length > 0 || isTyping) {
      if (chatBottomRef.current) {
        chatBottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      } else if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, [chatMessages, isTyping]);

  const activateSkill = async (skillId) => {
    try {
      const res = await fetch(`/api/skills/${skillId}/content`);
      if (!res.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `No skill found for /${skillId}.` }]);
        return false;
      }
      const content = await res.text();
      historyRef.current.injectSkill(content);
      const registryRes = await fetch('/api/skills');
      const registry = await registryRes.json();
      const skill = registry.find(s => s.id === skillId);
      setActiveSkill({ id: skillId, name: skill?.name || skillId });
      return true;
    } catch {
      return false;
    }
  };

  // Runs after onboarding skill completes — extracts profile from conversation history and stores as onboarding_data
  const finalizeOnboarding = async () => {
    const conversationMessages = historyRef.current.messages.filter(
      m => m.role === 'user' || m.role === 'assistant'
    );
    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxTokens: 300,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: 'Extract the onboarding profile from this conversation. Return ONLY a single pipe-separated string in exactly this format (fill real values, write "not provided" if missing):\nNorth star: X | Age: X | Country: X | Income: X | Dependents: X | Goal: X | Emergency fund: X | Debt: X',
            },
            ...conversationMessages,
          ],
        }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) storeFact(userId, 'onboarding_data', content, sessionId);
    } catch (e) {
      console.warn('[Onboarding] Failed to extract profile:', e);
    }
    setActiveSkill(null);
  };

  // Strips <ONBOARDING_COMPLETE> marker from display text; triggers extraction if found
  const checkOnboardingComplete = (text) => {
    if (!text.includes('<ONBOARDING_COMPLETE>')) return text;
    finalizeOnboarding();
    return text.replace('<ONBOARDING_COMPLETE>', '').trim();
  };

  const stripToolCallsForDisplay = (text) => {
    let result = text.replace(/<USE_TOOL>[\s\S]*?<\/USE_TOOL>/g, '');
    const openIdx = result.indexOf('<USE_TOOL>');
    if (openIdx !== -1) result = result.slice(0, openIdx);
    return result.trim();
  };

  const processToolCalls = async (text) => {
    const toolCallRegex = /<USE_TOOL>([\s\S]*?)<\/USE_TOOL>/g;
    const matches = [...text.matchAll(toolCallRegex)];
    if (matches.length === 0) return text;

    setChatMessages(prev => [
      ...prev.slice(0, -1),
      { role: 'assistant', content: '⚙️ Working on it...' },
    ]);

    for (const match of matches) {
      try {
        const toolCall = JSON.parse(match[1].trim());
        const res = await fetch(`/api/tools/${toolCall.tool}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toolCall.params || {}),
        });
        const data = await res.json();
        historyRef.current.add('user', `Tool result for ${toolCall.tool}: ${JSON.stringify(data.result ?? data.error)}`);
      } catch (e) {
        historyRef.current.add('user', `Tool call failed: ${e.message}`);
      }
    }

    // Follow-up LLM call to get a natural language response from the tool results
    setIsTyping(true);
    let streamStarted = false;
    let full = '';
    try {
      const streamRes = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyRef.current.getWithSystem() }),
      });
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const delta = JSON.parse(raw).choices?.[0]?.delta?.content || '';
            if (delta) {
              full += delta;
              if (!streamStarted) {
                streamStarted = true;
                setIsTyping(false);
              }
              setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: full }]);
            }
          } catch {}
        }
      }
      if (full) historyRef.current.add('assistant', full);
    } catch (e) {
      setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
    return null;
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || isTyping) return;
    setMessage('');

    if (text.startsWith('/')) {
      const skillId = text.slice(1).trim().toLowerCase();
      setChatMessages(prev => [...prev, { role: 'user', content: text }]);
      setIsTyping(true);
      const ok = await activateSkill(skillId);
      if (ok) {
        let streamStarted = false;
        try {
          await streamMessage('Begin the skill now.', historyRef.current, userId, sessionId, (_chunk, full) => {
            pendingFullRef.current = full;
            const display = stripToolCallsForDisplay(full);
            if (!streamStarted) {
              streamStarted = true;
              setIsTyping(false);
              setChatMessages(prev => [...prev, { role: 'assistant', content: display }]);
            } else if (!rafRef.current) {
              rafRef.current = requestAnimationFrame(() => {
                setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: stripToolCallsForDisplay(pendingFullRef.current) }]);
                rafRef.current = null;
              });
            }
          }, { skipMemoryAgent: true });
          // Flush any pending rAF and apply final content
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          let cleaned = checkOnboardingComplete(pendingFullRef.current);
          const skillToolResult = await processToolCalls(cleaned);
          if (skillToolResult !== null) {
            setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: skillToolResult }]);
          }
        } catch (err) {
          setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
          setIsTyping(false);
        }
      } else {
        setIsTyping(false);
      }
      return;
    }

    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsTyping(true);
    let streamStarted = false;
    const skillActive = !!activeSkill;
    try {
      await streamMessage(text, historyRef.current, userId, sessionId, (_chunk, full) => {
        pendingFullRef.current = full;
        const display = stripToolCallsForDisplay(full);
        if (!streamStarted) {
          streamStarted = true;
          setIsTyping(false);
          setChatMessages(prev => [...prev, { role: 'assistant', content: display }]);
        } else if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: stripToolCallsForDisplay(pendingFullRef.current) }]);
            rafRef.current = null;
          });
        }
      }, { skipMemoryAgent: skillActive });
      // Flush any pending rAF with final content
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      let finalText = skillActive ? checkOnboardingComplete(pendingFullRef.current) : pendingFullRef.current;
      const toolResult = await processToolCalls(finalText);
      if (toolResult !== null) {
        setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: toolResult }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const loadMemories = () => {
    setMemories(getMemories(userId));
  };

  const handleClearMemories = () => {
    clearMemory(userId);
    setMemories([]);
  };

  const handleDeleteMemory = (id) => {
    deleteMemory(userId, id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleOpenMemoryPanel = () => {
    loadMemories();
    setMemoryPanelOpen(true);
  };

  return (
    <div className="flex h-screen bg-dark text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-charcoal transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0 w-72 border-r border-white/5' : '-translate-x-full w-72 md:w-0 md:translate-x-0'} md:relative overflow-visible`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-lg md:flex hidden"
        >
          <ChevronRight size={14} className={sidebarOpen ? 'rotate-180' : ''} />
        </button>

        <div className="w-full h-full overflow-hidden">
          <div className="w-72 flex flex-col h-full bg-dark/40 backdrop-blur-xl transition-all duration-300">
            <div className="flex justify-between items-center mb-8 px-6 pt-6">
              <h2 className="text-[14px] font-bold text-white/90 flex items-center gap-2 uppercase tracking-[0.2em] border-l-2 border-brand-orange pl-3">
                History
              </h2>
            </div>

            <div className="space-y-[4px] overflow-y-auto flex-1 px-4">
              {chats.map(chat => (
                <React.Fragment key={chat.id}>
                  <button
                    onClick={() => setActiveChat(chat.id)}
                    className={`w-full text-left py-2 px-3 rounded-lg transition-all group flex items-center gap-3 ${activeChat === chat.id ? 'bg-white/5 border-l-2 border-brand-orange text-white' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}
                  >
                    <MessageSquare size={14} className={`${activeChat === chat.id ? 'text-brand-orange' : 'text-gray-600 group-hover:text-brand-orange'}`} />
                    <span className="text-[13px] font-medium truncate">{chat.title}</span>
                  </button>
                  <div className="h-[1px] w-full bg-white/5 last:hidden" />
                </React.Fragment>
              ))}
            </div>

            <div className="mt-auto px-4 pb-6">
              <div className="flex items-center gap-3 p-2.5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-orange to-brand-red flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-brand-orange/20">
                  {user?.name?.[0] || 'J'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white/90 truncate">{user?.name || 'Jane Doe'}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.email || 'jane@example.com'}</p>
                </div>
                <button onClick={onLogout} className="p-1.5 text-gray-500 hover:text-brand-red transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div ref={scrollContainerRef} className="flex-1 flex flex-col relative w-full overflow-y-auto overflow-x-hidden">
        {/* Background Ambient Glows */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-brand-orange/5 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-1/4 right-0 w-[800px] h-[800px] bg-brand-red/5 blur-[100px] rounded-full animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        </div>

        <div className="absolute top-6 left-6 z-40 flex gap-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 bg-charcoal rounded-md border border-white/10 hover:bg-charcoal/80 transition-all"
            >
              <Menu size={20} />
            </button>
          )}
          <button
            onClick={handleOpenMemoryPanel}
            className="p-2 bg-charcoal rounded-md border border-white/10 hover:bg-charcoal/80 transition-all"
          >
            <Brain size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center p-6 md:p-12 relative z-10 min-h-full">

          {/* Hero — always visible */}
          <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="relative mb-8 inline-block">
              <div className="absolute inset-0 bg-brand-orange/20 blur-[40px] rounded-full scale-150 animate-pulse" style={{ animationDuration: '6s' }} />
              <div className="relative w-20 h-20 bg-gradient-to-br from-brand-orange/10 to-brand-red/10 backdrop-blur-xl rounded-full border border-white/10 flex items-center justify-center shadow-2xl">
                <Brain size={42} className="text-brand-orange drop-shadow-[0_0_15px_rgba(255,107,53,0.6)]" />
              </div>
            </div>
            <h1 className="text-4xl md:text-[52px] font-extrabold mb-3 tracking-tighter leading-[1.1] text-white">
              Hey {user?.name?.split(' ')[0] || 'there'}, how can I <span className="bg-gradient-to-r from-brand-orange to-brand-red bg-clip-text text-transparent">help you</span> today?
            </h1>
            <p className="text-gray-500 max-w-lg mx-auto text-[15px] font-medium leading-relaxed opacity-80">
              Ask anything from data analytics to creative asset generation. <br />My intelligence is at your service.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-3xl mb-10">
            {[
              { id: 'skills', icon: GraduationCap, title: 'View Your Skills', desc: 'Browse and manage your available skills.' },
              { id: 'agents', icon: Bot, title: 'View Your Agents', desc: 'Manage your deployed AI agents.' },
              { id: 'connectors', icon: Plug, title: 'View Your Connectors', desc: 'Connect external tools and services.' }
            ].map((card, idx) => (
              <div
                key={idx}
                onClick={() => {
            setActivePanel(card.id);
            if (card.id === 'skills') fetch('/api/skills').then(r => r.json()).then(setSkillsRegistry).catch(() => {});
            if (card.id === 'agents') fetch('/api/agents').then(r => r.json()).then(setAgentsRegistry).catch(() => {});
            if (card.id === 'connectors') fetch('/api/connectors').then(r => r.json()).then(setConnectorsRegistry).catch(() => {});
          }}
                className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 hover:border-brand-orange/30 transition-all duration-300 group cursor-pointer active:scale-[0.98]"
              >
                <div className="p-2 rounded-xl bg-brand-orange/10 w-fit mb-3 group-hover:bg-brand-orange/20 transition-all duration-300 ring-1 ring-brand-orange/20">
                  <card.icon size={16} className="text-brand-orange" />
                </div>
                <h3 className="text-[13px] font-bold mb-1 text-white/90 group-hover:text-white transition-colors tracking-tight">{card.title}</h3>
                <p className="text-[11px] text-gray-500 group-hover:text-gray-400 leading-relaxed transition-colors">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Chat thread — appears below cards */}
          {(chatMessages.length > 0 || isTyping) && (
            <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange/20 to-brand-red/20 border border-white/10 flex items-center justify-center mr-3 mt-1 shrink-0">
                      <Brain size={16} className="text-brand-orange" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-2xl text-[14px] font-medium leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-brand-orange to-brand-red text-white rounded-br-sm shadow-lg shadow-brand-orange/20'
                        : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange/20 to-brand-red/20 border border-white/10 flex items-center justify-center mr-3 shrink-0">
                    <Brain size={16} className="text-brand-orange" />
                  </div>
                  <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-brand-orange/70 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Spacer for floating input */}
          <div ref={chatBottomRef} className="h-56 w-full shrink-0" />
        </div>

        {/* Bottom fade */}
        <div className={`fixed bottom-0 right-0 h-32 bg-gradient-to-t from-dark to-transparent pointer-events-none z-30 transition-all duration-300 ease-in-out ${sidebarOpen ? 'left-0 md:left-72' : 'left-0'}`} />

        {/* Floating Chat Input */}
        <div className={`fixed bottom-10 right-0 flex flex-col items-center gap-2 px-6 z-40 transition-all duration-300 ease-in-out ${sidebarOpen ? 'left-0 md:left-72' : 'left-0'}`}>
          {activeSkill && (
            <div className="w-full max-w-3xl flex items-center justify-between px-4 py-1.5 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <span className="text-[11px] font-bold text-brand-orange uppercase tracking-wider">
                Skill active: {activeSkill.name}
              </span>
              <button
                onClick={() => setActiveSkill(null)}
                className="text-brand-orange/60 hover:text-brand-orange transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="w-full max-w-3xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[24px] p-2 flex items-center shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-700">
            <div className="p-3">
              <Brain size={20} className="text-gray-400 opacity-60" />
            </div>
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-white px-2 placeholder:text-gray-500 font-medium text-[15px]"
              placeholder="Ask anything..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <div className="flex items-center gap-2 pr-2">
              <button className="p-2.5 text-gray-500 hover:text-brand-orange transition-all">
                <Mic size={20} />
              </button>
              <button
                onClick={handleSend}
                disabled={isTyping || !message.trim()}
                className="bg-gradient-to-br from-brand-orange to-brand-red p-3 rounded-2xl text-white hover:shadow-lg hover:shadow-brand-orange/30 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Panel Overlay */}
      {memoryPanelOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 transition-opacity" onClick={() => setMemoryPanelOpen(false)} />
      )}

      {/* Memory Panel */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-80 bg-charcoal border-l border-white/10 z-50 flex flex-col transition-transform duration-300 ease-in-out ${memoryPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Memory</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Stored locally in your browser only.</p>
          </div>
          <button onClick={() => setMemoryPanelOpen(false)}>
            <X size={18} className="text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Memory List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {memories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <Brain size={32} className="text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm italic">No memories stored yet.</p>
            </div>
          ) : (
            memories.map((mem) => (
              <div key={mem.id} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-brand-orange/30 transition-all group">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-1.5 py-0.5 rounded">
                    {mem.type.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => handleDeleteMemory(mem.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-brand-red transition-all p-0.5 rounded"
                    title="Delete this memory"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[13px] text-white/80 leading-relaxed">{mem.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 bg-dark/20">
          <button
            onClick={handleClearMemories}
            className="w-full py-2.5 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red text-sm font-semibold hover:bg-brand-red/20 transition-all active:scale-[0.98]"
          >
            Clear All Memories
          </button>
        </div>
      </div>

      {/* Feature Panels Overlay */}
      {activePanel && (
        <div className="fixed inset-0 bg-black/60 z-50 transition-opacity backdrop-blur-sm" onClick={() => setActivePanel(null)} />
      )}

      {/* Feature Panels */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-charcoal border-l border-white/10 z-50 flex flex-col transition-transform duration-300 ease-in-out ${activePanel ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-dark/40">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-white/90">
            {activePanel === 'skills' && 'Your Skills'}
            {activePanel === 'agents' && 'Your Agents'}
            {activePanel === 'connectors' && 'Your Connectors'}
          </h2>
          <div className="flex items-center gap-4">
            <button className="text-[11px] font-bold text-brand-orange hover:text-brand-orange/80 transition-colors uppercase tracking-wider">
              {activePanel === 'skills' && '+ Add Skill'}
              {activePanel === 'agents' && '+ Add Agent'}
              {activePanel === 'connectors' && '+ Add Connector'}
            </button>
            <button onClick={() => setActivePanel(null)}>
              <X size={18} className="text-gray-400 hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activePanel === 'skills' && (
            <div className="space-y-3">
              {skillsRegistry.length === 0 ? (
                <div className="flex items-center justify-center h-40 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                  <div className="text-center">
                    <GraduationCap size={32} className="text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm italic">No skills added yet.</p>
                  </div>
                </div>
              ) : (
                skillsRegistry.map(skill => (
                  <div key={skill.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-brand-orange/30 transition-all group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0 mt-0.5 group-hover:bg-brand-orange/20 transition-all">
                        <Zap size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white/90 group-hover:text-white transition-colors">{skill.name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{skill.description}</p>
                        <span className="inline-block mt-2 text-[10px] font-mono text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded">
                          {skill.trigger}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activePanel === 'agents' && (
            <div className="space-y-3">
              {agentsRegistry.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                  <Bot size={32} className="text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm italic">No agents configured yet.</p>
                </div>
              ) : (
                agentsRegistry.map(agent => (
                  <div key={agent.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-brand-orange/30 transition-all group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0 mt-0.5 group-hover:bg-brand-orange/20 transition-all">
                        <Bot size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[13px] font-bold text-white/90 group-hover:text-white transition-colors">{agent.name}</p>
                          {agent.status === 'active' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">Active</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{agent.description}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activePanel === 'connectors' && (
            <div className="space-y-3">
              {connectorsRegistry.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                  <Plug size={32} className="text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm italic">No connectors configured yet.</p>
                </div>
              ) : (
                connectorsRegistry.map(connector => (
                  <div key={connector.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-brand-orange/30 transition-all group">
                    <div className="flex items-start gap-3">
                      {connector.logo ? (
                        <img src={connector.logo} alt={connector.name} className="w-8 h-8 rounded-lg object-contain shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0 mt-0.5 group-hover:bg-brand-orange/20 transition-all">
                          <Plug size={14} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[13px] font-bold text-white/90 group-hover:text-white transition-colors">{connector.name}</p>
                          {connector.status === 'connected' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">Connected</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{connector.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {connector.categories?.map(cat => (
                            <span key={cat} className="text-[9px] font-medium text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{cat}</span>
                          ))}
                          <span className="text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                            {connector.actions?.length || 0} actions
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
