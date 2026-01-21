import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    X, 
    Pin, 
    Trash2
} from 'lucide-react';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const historyItems = [
    { id: 1, title: 'Phase Humans Final', description: 'A prompt-to-website generator with a high-fidelity dark mode UI, context canvas, and advanced animations.', time: '8 minutes ago' },
    { id: 2, title: 'E-commerce Dashboard', description: 'Modern dark mode dashboard for shopify store with analytics charts and order tables.', time: '53 minutes ago' },
    { id: 3, title: 'SaaS Landing Page', description: 'High conversion landing page for AI tool with pricing grids and testimonials.', time: '1 hour ago' },
    { id: 4, title: 'Portfolio v2', description: 'Minimalist portfolio for photographer focusing on large imagery and typography.', time: '2 hours ago' },
    { id: 5, title: 'Crypto Exchange', description: 'Real-time trading interface with candlestick charts and order book.', time: 'Yesterday' },
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

    const filteredItems = historyItems.filter(item => 
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );

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
                        transition={{ type: "spring", duration: 0.5 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="w-full max-w-2xl bg-[#0e0e0e] border border-white/10 rounded-xl shadow-2xl pointer-events-auto flex flex-col max-h-[600px] overflow-hidden">
                            
                            {/* Search Header */}
                            <div className="flex items-center px-4 py-4 border-b border-white/5 gap-3 bg-[#0e0e0e]">
                                <Search className="text-neutral-500" size={16} />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Search for an app..." 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-neutral-200 placeholder-neutral-500 h-6 font-light"
                                />
                            </div>

                            {/* List */}
                            <div className="overflow-y-auto flex-1">
                                {filteredItems.length > 0 ? (
                                    <div className="divide-y divide-white/[0.03]">
                                        {filteredItems.map((item) => (
                                            <div 
                                                key={item.id}
                                                className="group relative flex items-start justify-between p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                                            >
                                                <div className="pr-12">
                                                    <div className="text-sm font-medium text-blue-400 mb-1 group-hover:text-blue-300 transition-colors">
                                                        {item.title}
                                                    </div>
                                                    <div className="text-sm text-neutral-400 font-light leading-relaxed line-clamp-2 mb-2">
                                                        {item.description}
                                                    </div>
                                                    <div className="text-xs text-neutral-600 font-mono">
                                                        Last modified: {item.time}
                                                    </div>
                                                </div>

                                                {/* Hover Actions */}
                                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-1.5 text-neutral-500 hover:text-white transition-colors hover:bg-white/5 rounded-md">
                                                        <Pin size={14} />
                                                    </button>
                                                    <button className="p-1.5 text-neutral-500 hover:text-white transition-colors hover:bg-white/5 rounded-md">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center text-neutral-500 text-sm font-light">
                                        No results found for "{search}"
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-600 font-mono">
                                <span>Press ESC to close</span>
                                <span>{filteredItems.length} projects</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};