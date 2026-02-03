import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, Mode } from './types';
import { sendMessageStream } from './services/geminiService';
import HistoryItem from './components/HistoryItem';
import { O1Logo } from './components/TerminalIcon';

const INITIAL_MESSAGE: Message = {
  id: 'init-1',
  role: Role.ASSISTANT,
  content: `> boot sequence initiated...
[0.002s] loading kernel modules... OK
[0.015s] verifying neural link... OK
[0.042s] mounting file system (read-only)... OK
[0.089s] starting context manager... OK

o1 :: a boring, disciplined, deterministic coding agent that lives in your terminal.
v0.9.5-stable (c) 2024 AI Research Lab.

System ready. Mode: BUILD.
Type \`/help\` for available commands.`,
  timestamp: Date.now(),
  isStreaming: false
};

const COMMANDS = [
  { cmd: '/clear', desc: 'Clear terminal output' },
  { cmd: '/reset', desc: 'Reset session context' },
  { cmd: '/mode', desc: 'Toggle PLAN/BUILD mode' },
  { cmd: '/help', desc: 'List commands' },
];

export default function App() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<Mode>(Mode.BUILD);
  
  // Command Menu State
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);
  
  // Refs for scrolling and focus
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCommands = COMMANDS.filter(c => c.cmd.startsWith(input));

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isProcessing]);

  // Focus input on mount and click
  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    // Only re-focus if we aren't selecting text
    const handleClick = () => {
        if (document.getSelection()?.type !== 'Range') {
            inputRef.current?.focus();
        }
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Command Menu Navigation
    if (showCommandMenu && filteredCommands.length > 0) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedCmdIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedCmdIndex(prev => (prev + 1) % filteredCommands.length);
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const cmd = filteredCommands[selectedCmdIndex];
            if (cmd) {
                setInput(cmd.cmd + ' ');
                setShowCommandMenu(false);
            }
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setShowCommandMenu(false);
            return;
        }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      setMode(prev => prev === Mode.BUILD ? Mode.PLAN : Mode.BUILD);
      return;
    }

    if (e.key === 'Enter') {
        if (e.shiftKey) {
            // Allow default behavior (new line) but maybe manual resize needed if not using auto-resize logic in onChange
            return;
        }
        e.preventDefault();
        handleSubmit(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';

    if (val.startsWith('/')) {
        setShowCommandMenu(true);
        setSelectedCmdIndex(0);
    } else {
        setShowCommandMenu(false);
    }
  };

  const handleCommand = (cmdStr: string) => {
    const cmd = cmdStr.trim().split(' ')[0];
    let responseText = '';
    
    switch (cmd) {
        case '/clear':
            setHistory([INITIAL_MESSAGE]);
            return;
        case '/reset':
            setHistory([INITIAL_MESSAGE]);
            // Logic to reset actual AI session would go here
            responseText = 'Session reset.';
            break;
        case '/mode':
            setMode(prev => prev === Mode.BUILD ? Mode.PLAN : Mode.BUILD);
            responseText = `Switched to ${mode === Mode.BUILD ? 'PLAN' : 'BUILD'} mode.`;
            break;
        case '/help':
            responseText = `Available commands:
/clear - Clear terminal history
/reset - Reset session context
/mode  - Toggle build/plan mode
/help  - Show this help message`;
            break;
        default:
            responseText = `Command not found: ${cmd}`;
    }

    if (responseText) {
        const sysMsg: Message = {
            id: Date.now().toString(),
            role: Role.SYSTEM,
            content: responseText,
            timestamp: Date.now()
        };
        setHistory(prev => [...prev, sysMsg]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Just in case
    if (!input.trim() || isProcessing) return;

    // Handle Commands
    if (input.startsWith('/')) {
        handleCommand(input);
        setInput('');
        setShowCommandMenu(false);
        if (inputRef.current) inputRef.current.style.height = 'auto';
        return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content: input,
      timestamp: Date.now()
    };

    // Optimistic update
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsProcessing(true);

    // Placeholder for AI response
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: Role.ASSISTANT,
      content: '', // Start empty
      timestamp: Date.now(),
      isStreaming: true
    };
    
    setHistory(prev => [...prev, assistantMsg]);

    try {
      const contextMessage = `[MODE: ${mode}]\n${userMsg.content}`;
      await sendMessageStream(contextMessage, (chunk) => {
         setHistory(prev => prev.map(msg => {
            if (msg.id === assistantMsgId) {
                return { ...msg, content: msg.content + chunk };
            }
            return msg;
         }));
         bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setHistory(prev => prev.map(msg => 
        msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
      ));
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background text-zinc-300 font-mono overflow-hidden relative selection:bg-zinc-700 selection:text-white text-sm md:text-base">
      
      {/* Main Content Area */}
      <main 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth z-0"
      >
         <div className="max-w-3xl mx-auto pt-8 pb-8 min-h-full flex flex-col justify-end">
            {history.map((msg) => (
              <HistoryItem key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
         </div>
      </main>

      {/* Input Line (Terminal Style) */}
      <div className="flex-none z-20 bg-background border-t border-zinc-800 relative">
        <div className="max-w-3xl mx-auto px-4 md:px-0 relative">
          
          {/* Command Menu Popup */}
          {showCommandMenu && filteredCommands.length > 0 && (
             <div className="absolute bottom-full left-0 mb-1 w-72 bg-[#0c0c0e] border border-zinc-700 shadow-2xl z-50 font-mono">
                <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">COMMAND_PALETTE</span>
                    <span className="text-[10px] text-zinc-600">TAB_SEL</span>
                </div>
                <div className="p-1">
                    {filteredCommands.map((cmd, idx) => (
                        <div 
                            key={cmd.cmd}
                            className={`px-3 py-2 text-xs flex justify-between items-center cursor-pointer transition-none ${
                                idx === selectedCmdIndex 
                                ? 'bg-zinc-100 text-zinc-950 font-bold' // Inverted high-contrast selection
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                            onClick={() => {
                                setInput(cmd.cmd + ' ');
                                setShowCommandMenu(false);
                                inputRef.current?.focus();
                            }}
                        >
                            <span>{cmd.cmd}</span>
                            <span className={idx === selectedCmdIndex ? 'text-zinc-800' : 'opacity-50'}>{cmd.desc}</span>
                        </div>
                    ))}
                </div>
             </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col relative">
            
            {/* The Prompt Line */}
            <div className="flex items-start w-full py-4">
               {/* Prompt Text */}
               <div className="flex items-center gap-2 mr-3 select-none h-6 mt-[1px]">
                  <span className="font-bold text-zinc-100">o1</span>
                  <span className="text-zinc-600">::</span>
                  <span className={`${mode === Mode.BUILD ? 'text-blue-400' : 'text-purple-400'} font-bold`}>
                    {mode}
                  </span>
                  <span className="text-zinc-500">&gt;</span>
               </div>

               {/* Input Field (Textarea) */}
               <textarea
                 ref={inputRef}
                 value={input}
                 onChange={handleChange}
                 onKeyDown={handleKeyDown}
                 className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-700 font-mono font-medium resize-none overflow-hidden"
                 placeholder="Ask anything..."
                 rows={1}
                 style={{ minHeight: '24px' }}
                 autoComplete="off"
                 autoFocus
                 spellCheck={false}
                 disabled={isProcessing}
               />
            </div>
            
            {/* Hints Footer */}
            <div className="flex justify-between items-center pb-2 text-[10px] text-zinc-600 uppercase tracking-widest font-semibold select-none">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="text-zinc-400">TAB</span> Mode</span>
                  <span><span className="text-zinc-400">/</span> Cmds</span>
                  <span><span className="text-zinc-400">⇧ ↵</span> New Line</span>
                  <span><span className="text-zinc-400">ESC</span> Abort</span>
                </div>
                <div className="flex gap-2">
                    {isProcessing ? (
                        <span className="text-amber-500 animate-pulse">Running...</span>
                    ) : (
                        <span>Idle</span>
                    )}
                </div>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}