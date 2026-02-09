import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainPromptInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onImageUpload?: (file: File) => void;
}

export const MainPromptInput: React.FC<MainPromptInputProps> = ({ value, onChange, onSubmit, onImageUpload }) => {
    const [placeholderText, setPlaceholderText] = useState("Ask PhaseHumans to ");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Typewriter Effect
    useEffect(() => {
        const prefix = "Ask PhaseHumans to ";
        const suffixes = [
            "create a prototype...",
            "create a landing page...",
            "build a dashboard...",
            "design a portfolio...",
            "build a mobile app..."
        ];
        
        let currentPhraseIndex = 0;
        let currentCharIndex = 0;
        let isDeleting = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        const type = () => {
            const currentSuffix = suffixes[currentPhraseIndex];
            
            if (isDeleting) {
                currentCharIndex--;
            } else {
                currentCharIndex++;
            }

            setPlaceholderText(prefix + currentSuffix.substring(0, currentCharIndex));

            let typeSpeed = isDeleting ? 30 : 50;

            if (!isDeleting && currentCharIndex === currentSuffix.length) {
                typeSpeed = 3000;
                isDeleting = true;
            } else if (isDeleting && currentCharIndex === 0) {
                isDeleting = false;
                currentPhraseIndex = (currentPhraseIndex + 1) % suffixes.length;
                typeSpeed = 500;
            }

            timeoutId = setTimeout(type, typeSpeed);
        };

        timeoutId = setTimeout(type, 100);
        return () => clearTimeout(timeoutId);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) onSubmit();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageUpload?.(e.target.files[0]);
        }
    };

    return (
        <div className="w-full max-w-[52rem] bg-[#09090b] rounded-[28px] p-3 shadow-2xl border border-white/10 ring-1 ring-white/5 relative group transition-all focus-within:ring-white/20 focus-within:bg-[#0c0c0e]">
            <textarea 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholderText}
                className="w-full bg-transparent text-white text-lg p-2 min-h-[40px] resize-none outline-none placeholder-neutral-600 font-light leading-relaxed scrollbar-hide"
                spellCheck={false}
            />

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
            />

            <div className="flex items-center justify-between mt-2 px-1">
                {/* Left Actions */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors" 
                        title="Add Image to Canvas"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onSubmit}
                        disabled={!value.trim()}
                        className={cn(
                            "inline-flex items-center justify-center rounded-full text-sm font-medium transition-all duration-200 h-10 w-10 disabled:opacity-50 disabled:cursor-not-allowed",
                            value.trim() 
                                ? "bg-white text-black hover:opacity-90 shadow-[0_0_10px_rgba(255,255,255,0.05)]" 
                                : "bg-neutral-800 text-neutral-500"
                        )}
                    >
                        <ArrowUp size={20} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
};