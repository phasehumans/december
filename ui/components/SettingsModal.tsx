import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    LogOut,
    User,
    Check,
    Bell,
    Mail,
    Github
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onLogout }) => {
    const [name, setName] = useState("Alex Chen");
    const [email, setEmail] = useState("alex@example.com");
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleUpdate = () => {
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 1500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="w-full max-w-[400px] bg-[#09090B] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col ring-1 ring-white/5">
                            
                            {/* Minimal Header */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#09090B]">
                                <h2 className="text-sm font-semibold text-white tracking-wide">Account Settings</h2>
                                <button 
                                    onClick={onClose} 
                                    className="text-neutral-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Content - Single View */}
                            <div className="p-6 space-y-6">
                                
                                {/* Profile Summary */}
                                <div className="flex items-center gap-4">
                                     <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-lg font-medium text-neutral-300 border border-white/10 relative overflow-hidden group cursor-pointer">
                                        AC
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white font-medium backdrop-blur-[1px]">
                                            EDIT
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">{name}</div>
                                        <div className="text-xs text-neutral-500">Free Plan</div>
                                    </div>
                                </div>

                                {/* Inputs */}
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 ml-1">Full Name</label>
                                        <div className="relative group">
                                            <input 
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-[#121212] border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-white/20 focus:bg-[#151515] transition-all placeholder-neutral-700 font-sans"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 ml-1">Email</label>
                                        <div className="relative group">
                                            <input 
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-[#121212] border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-white/20 focus:bg-[#151515] transition-all placeholder-neutral-700 font-sans"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Integrations/Options */}
                                <div className="space-y-2 pt-2">
                                     <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <Github size={16} className="text-neutral-400 group-hover:text-white transition-colors" />
                                            <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">GitHub</span>
                                        </div>
                                        <span className="text-[10px] text-green-500 flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                            Connected
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center gap-3">
                                            <Bell size={16} className="text-neutral-400" />
                                            <span className="text-sm text-neutral-300">Product Updates</span>
                                        </div>
                                        <button 
                                            onClick={() => setEmailNotifications(!emailNotifications)}
                                            className={cn(
                                                "w-8 h-4 rounded-full relative transition-colors duration-300 ease-out border",
                                                emailNotifications ? "bg-white border-white" : "bg-transparent border-neutral-700"
                                            )}
                                        >
                                            <span 
                                                className={cn(
                                                    "absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full shadow-sm transition-transform duration-300 ease-out",
                                                    emailNotifications ? "translate-x-4 bg-black" : "translate-x-0 bg-neutral-500"
                                                )} 
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-white/5 bg-[#09090B] flex justify-between items-center gap-4">
                                <button 
                                    onClick={onLogout}
                                    className="text-xs text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-2 px-2 py-1.5"
                                >
                                    <LogOut size={14} />
                                    Sign Out
                                </button>

                                <button 
                                    onClick={handleUpdate}
                                    className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-neutral-200 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                >
                                    {isUpdating ? <Check size={12} className="animate-in zoom-in" /> : null}
                                    {isUpdating ? 'Saved' : 'Save Changes'}
                                </button>
                            </div>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};