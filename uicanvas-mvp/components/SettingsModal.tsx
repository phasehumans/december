import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    LogOut,
    User,
    Check,
    Bell
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
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="w-full max-w-[380px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden ring-1 ring-white/5">
                            
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                                <h2 className="text-sm font-medium text-white tracking-tight">Account Settings</h2>
                                <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md">
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-6">
                                
                                {/* Profile Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-sm font-medium text-neutral-300">
                                            AC
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">Profile</div>
                                            <div className="text-[10px] text-neutral-500 font-light">Manage your public information</div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider ml-1">Display Name</label>
                                            <input 
                                                type="text" 
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none transition-colors font-light placeholder-neutral-700"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider ml-1">Email</label>
                                            <input 
                                                type="email" 
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none transition-colors font-light placeholder-neutral-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5" />

                                {/* Preferences Section */}
                                <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Bell size={14} className="text-neutral-400" />
                                            <span className="text-sm text-neutral-200 font-light">Email Notifications</span>
                                        </div>
                                        <button 
                                            onClick={() => setEmailNotifications(!emailNotifications)}
                                            className={cn(
                                                "w-9 h-5 rounded-full relative transition-colors duration-200 ease-in-out border border-transparent",
                                                emailNotifications ? "bg-white" : "bg-neutral-800 border-neutral-700"
                                            )}
                                        >
                                            <span 
                                                className={cn(
                                                    "absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-200 ease-in-out",
                                                    emailNotifications ? "translate-x-4 bg-black" : "translate-x-0 bg-neutral-400"
                                                )} 
                                            />
                                        </button>
                                     </div>
                                </div>

                                <button 
                                    onClick={handleUpdate}
                                    className="w-full flex items-center justify-center gap-2 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-neutral-200 transition-all shadow-lg shadow-white/5"
                                >
                                    {isUpdating ? <Check size={12} /> : null}
                                    {isUpdating ? 'Saved' : 'Save Changes'}
                                </button>
                            </div>

                            {/* Footer */}
                            <div className="bg-[#050505] border-t border-white/5 px-5 py-3 flex justify-between items-center">
                                <span className="text-[10px] text-neutral-600 font-mono">ID: user_8x92m</span>
                                <button 
                                    onClick={onLogout}
                                    className="flex items-center gap-1.5 text-[10px] font-medium text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                                >
                                    <LogOut size={12} />
                                    Sign Out
                                </button>
                            </div>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};