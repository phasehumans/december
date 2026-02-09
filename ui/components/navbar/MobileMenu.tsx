import React from 'react';
import { motion } from 'framer-motion';
import { X, Github } from 'lucide-react';
import { Logo } from '../Logo';

// X (Twitter) Icon
const XIcon = ({ className }: { className?: string }) => (
  <svg role="img" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
  </svg>
);

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    isAuthenticated: boolean;
    onLogin: () => void;
    onSignup: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ 
    isOpen, 
    onClose, 
    isAuthenticated, 
    onLogin, 
    onSignup 
}) => {
    if (!isOpen) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-[60] bg-[#050505] p-6 md:hidden flex flex-col"
        >
            <div className="flex items-center justify-between mb-12">
                <Logo className="scale-100" />
                <button 
                    onClick={onClose}
                    className="text-neutral-400 hover:text-white p-2 bg-white/5 rounded-full"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex flex-col gap-6 flex-1">
                    <div className="flex flex-col gap-4">
                    <a href="#" className="flex items-center gap-3 text-neutral-400 hover:text-white text-lg font-medium group">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <XIcon className="w-5 h-5" />
                        </div>
                        Follow on X
                    </a>
                    <a href="#" className="flex items-center gap-3 text-neutral-400 hover:text-white text-lg font-medium group">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <Github className="w-5 h-5" />
                        </div>
                        Star on GitHub
                    </a>
                    </div>
            </div>

            <div className="mt-auto flex flex-col gap-3 pb-6">
                {!isAuthenticated ? (
                    <>
                        <button 
                            onClick={() => { onLogin(); onClose(); }}
                            className="w-full py-3 text-sm font-medium text-white border border-white/10 rounded-full hover:bg-white/5 transition-colors"
                        >
                            Log in
                        </button>
                        <button 
                            onClick={() => { onSignup(); onClose(); }}
                            className="w-full py-3 bg-white text-black text-sm font-bold rounded-full hover:bg-neutral-200 transition-colors shadow-lg"
                        >
                            Get started
                        </button>
                    </>
                ) : (
                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-neutral-800 text-white text-sm font-bold rounded-full"
                    >
                        Back to App
                    </button>
                )}
            </div>
        </motion.div>
    );
};