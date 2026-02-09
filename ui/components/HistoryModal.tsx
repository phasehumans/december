import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock } from 'lucide-react';
import { HistoryItem } from './history/HistoryItem';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const historyItems = [
    { id: 1, title: 'Phase Humans Final', description: 'Prompt-to-website generator UI.', time: '8m ago', type: 'SaaS' },
    { id: 2, title: 'E-commerce Dashboard', description: 'Shopify analytics view with graphs.', time: '53m ago', type: 'Dashboard' },
    { id: 3, title: 'SaaS Landing Page', description: 'High conversion landing page.', time: '1h ago', type: 'Landing' },
    { id: 4, title: 'Portfolio v2', description: 'Minimalist photographer portfolio.', time: '2h ago', type: 'Portfolio' },
    { id: 5, title: 'Crypto Exchange', description: 'Trading interface with charts.', time: '1d ago', type: 'App' },
    { id: 6, title: 'Medical Admin', description: 'Patient records management system.', time: '2d ago', type: 'Dashboard' },
];

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
    const [search, setSearch] = useState('');

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Prevent scrolling when modal is open
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
      return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const filteredItems = historyItems.filter(item => 
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
                    />
                    
                    {/* Modal */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="w-full max-w-xl bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[600px] overflow-hidden ring-1 ring-white/5">
                            
                            {/* Header */}
                            <div className="p-4 border-b border-white/5 bg-[#09090b] flex items-center justify-between">
                                <h2 className="text-lg font-display font-medium text-white tracking-tight flex items-center gap-2">
                                    <Clock size={18} className="text-neutral-500" />
                                    Project History
                                </h2>
                                <button 
                                    onClick={onClose}
                                    className="p-1.5 text-neutral-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="px-4 py-3 bg-[#09090b]">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-white transition-colors" size={16} />
                                    <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="Search projects..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full bg-[#121214] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/10 focus:bg-[#18181b] transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* List */}
                            <div className="overflow-y-auto flex-1 p-2 space-y-1 bg-[#09090b]">
                                {filteredItems.length > 0 ? (
                                    <>
                                        <div className="px-3 py-2 text-[10px] font-mono font-medium text-neutral-600 uppercase tracking-widest">
                                            Recent
                                        </div>
                                        {filteredItems.map((item) => (
                                            <HistoryItem key={item.id} item={item} />
                                        ))}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                                        <Search size={32} className="text-neutral-600 mb-3" />
                                        <p className="text-sm text-neutral-500">No projects found.</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer */}
                            <div className="p-3 bg-[#0c0c0e] border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                                <span>Showing {filteredItems.length} projects</span>
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1.5">
                                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-neutral-300 border border-white/5">ESC</span>
                                        close
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};