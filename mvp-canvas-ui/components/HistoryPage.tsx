import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Clock, 
    ArrowRight, 
    Search, 
    MoreHorizontal, 
    Calendar,
    LayoutTemplate,
    Code2,
    Zap,
    Trash2,
    Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryItem {
    id: number;
    title: string;
    time: string;
    category: string;
    type: string;
    preview: string;
    prompt: string;
}

// Mock Data
const historyData: HistoryItem[] = [
    { 
        id: 1, 
        title: 'E-commerce Dashboard', 
        time: '2 hours ago', 
        category: 'Today',
        type: 'Dashboard',
        preview: 'bg-blue-500/10',
        prompt: 'Modern dark mode dashboard for shopify store with analytics charts and order tables...' 
    },
    { 
        id: 2, 
        title: 'Portfolio v2', 
        time: '5 hours ago', 
        category: 'Today',
        type: 'Landing Page',
        preview: 'bg-purple-500/10',
        prompt: 'Minimalist portfolio for photographer focusing on large imagery and typography...' 
    },
    { 
        id: 3, 
        title: 'SaaS Landing Page', 
        time: 'Yesterday', 
        category: 'Yesterday',
        type: 'Landing Page',
        preview: 'bg-green-500/10',
        prompt: 'High conversion landing page for AI tool with pricing grids and testimonials...' 
    },
    { 
        id: 4, 
        title: 'Crypto Exchange', 
        time: 'Yesterday', 
        category: 'Yesterday',
        type: 'Dashboard',
        preview: 'bg-orange-500/10',
        prompt: 'Real-time trading interface with candlestick charts and order book...' 
    },
    { 
        id: 5, 
        title: 'Blog Template', 
        time: 'Dec 12', 
        category: 'Previous 7 Days',
        type: 'Content',
        preview: 'bg-pink-500/10',
        prompt: 'CMS ready blog layout with sidebar and reading progress bar...' 
    },
];

const HistoryCard: React.FC<{ item: HistoryItem }> = ({ item }) => (
    <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -2 }}
        className="group relative bg-[#0A0A0A] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]"
    >
        {/* Preview Area */}
        <div className={cn("h-32 w-full flex items-center justify-center border-b border-white/5 relative overflow-hidden", item.preview)}>
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0A0A0A_100%)] opacity-50" />
             <LayoutTemplate className="text-white/20 group-hover:text-white/40 transition-colors transform group-hover:scale-110 duration-500" size={32} />
             
             {/* Overlay Actions */}
             <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-200">
                <button className="p-1.5 bg-black/50 backdrop-blur-md rounded-md border border-white/10 text-white hover:bg-white/20 transition-colors">
                    <Copy size={12} />
                </button>
                <button className="p-1.5 bg-black/50 backdrop-blur-md rounded-md border border-white/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    <Trash2 size={12} />
                </button>
             </div>
        </div>

        {/* Content */}
        <div className="p-4">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-neutral-200 group-hover:text-white truncate pr-4">{item.title}</h3>
                <div className="p-1 text-neutral-600 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer">
                    <MoreHorizontal size={16} />
                </div>
            </div>
            
            <p className="text-xs text-neutral-500 line-clamp-2 mb-4 leading-relaxed font-light">
                {item.prompt}
            </p>

            <div className="flex items-center justify-between text-[10px] text-neutral-600 font-mono pt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                        <Code2 size={10} />
                        {item.type}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Clock size={10} />
                    {item.time}
                </div>
            </div>
        </div>
    </motion.div>
);

export const HistoryPage = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredData = historyData.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.prompt.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groupedData = filteredData.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, HistoryItem[]>);

    return (
        <div className="w-full h-full overflow-y-auto bg-[#050505]">
            <div className="max-w-6xl mx-auto px-6 py-10">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">History</h1>
                        <p className="text-neutral-400">Manage and restore your generated interfaces.</p>
                    </div>

                    <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-white transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search projects..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                        />
                    </div>
                </div>

                {/* Grid Content */}
                <div className="space-y-10">
                    {Object.entries(groupedData).map(([category, items]) => (
                        <div key={category}>
                            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 font-mono pl-1">{category}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {items.map((item) => (
                                    <HistoryCard key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    {filteredData.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p>No projects found matching "{searchQuery}"</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};