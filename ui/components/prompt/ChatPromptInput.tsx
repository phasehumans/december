import React from 'react';
import { ArrowUp, Plus, MousePointer2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface ChatPromptInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    isVisualMode: boolean;
    onToggleVisualMode: () => void;
    selectedElement: { tagName: string, textContent: string } | null;
    onClearSelection: () => void;
    isApplyingEdit: boolean;
}

export const ChatPromptInput: React.FC<ChatPromptInputProps> = ({ 
    value, 
    onChange, 
    onSubmit, 
    isVisualMode, 
    onToggleVisualMode,
    selectedElement,
    onClearSelection,
    isApplyingEdit
}) => {
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) onSubmit();
        }
    };

    return (
        <div className="p-4 bg-[#050505] shrink-0 z-30">
            <div className={cn(
                "w-full bg-[#09090b] rounded-[24px] border transition-all shadow-inner relative overflow-hidden group flex flex-col",
                isVisualMode 
                    ? "border-white/20 ring-1 ring-white/10" 
                    : "border-white/10 ring-1 ring-white/5 focus-within:ring-white/20"
            )}>
                {/* Integrated Selected Element Display */}
                <AnimatePresence>
                    {selectedElement && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-b border-white/5 bg-white/[0.02]"
                        >
                             <div className="flex items-center gap-2 px-3 py-2">
                                <span className="text-[9px] font-bold bg-white/10 text-white border border-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    {selectedElement.tagName}
                                </span>
                                <span className="text-xs text-neutral-300 truncate max-w-[200px] font-medium">
                                    {selectedElement.textContent}
                                </span>
                                <Button 
                                    variant="ghost" 
                                    size="icon-sm"
                                    onClick={onClearSelection} 
                                    className="ml-auto rounded-full hover:bg-white/10"
                                >
                                    <X size={12} />
                                </Button>
                             </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <textarea 
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedElement ? "Describe changes for this element..." : "Ask a follow-up..."}
                    className="w-full bg-transparent text-[15px] text-white px-4 py-3 min-h-[80px] max-h-[200px] resize-none outline-none placeholder-neutral-600 font-light leading-relaxed scrollbar-hide"
                />
                <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full hover:bg-neutral-800"
                        >
                            <Plus size={18} />
                        </Button>
                        
                        {/* Visual Edits Toggle */}
                        <Button
                            variant="ghost"
                            onClick={onToggleVisualMode}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border select-none h-8",
                                isVisualMode
                                    ? "bg-neutral-100 text-black border-neutral-200 shadow-[0_0_10px_rgba(255,255,255,0.1)] hover:bg-neutral-200 hover:text-black" 
                                    : "bg-transparent text-neutral-500 border-transparent hover:bg-white/5 hover:text-neutral-300"
                            )}
                        >
                            <MousePointer2 size={12} />
                            <span>Visual edits</span>
                        </Button>
                    </div>
                    
                    <Button 
                        size="icon"
                        variant={value.trim() ? "primary" : "secondary"}
                        onClick={onSubmit}
                        disabled={!value.trim() && !isApplyingEdit}
                        className={cn(
                            "rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                            !value.trim() && "bg-neutral-800 text-neutral-500 border-transparent"
                        )}
                        isLoading={isApplyingEdit}
                    >
                         {!isApplyingEdit && <ArrowUp size={18} strokeWidth={2.5} />}
                    </Button>
                </div>
            </div>
        </div>
    );
};