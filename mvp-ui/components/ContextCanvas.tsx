import React, { useState } from 'react';
import { 
  Image, 
  FileText, 
  Link as LinkIcon, 
  PenTool, 
  Shapes, 
  Eraser, 
  MousePointer2,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CanvasItem } from '@/types';
import { cn } from '@/lib/utils';

interface ContextCanvasProps {
    items: CanvasItem[];
    onAddItem: (item: CanvasItem) => void;
}

const MinimalDockItem = ({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className="group relative p-2.5 rounded-xl hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
    >
        <Icon size={18} strokeWidth={1.5} className="transition-colors group-hover:scale-110 duration-200" />
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#1a1a1a] border border-white/10 text-white text-[10px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap pointer-events-none shadow-xl z-50">
            {label}
        </span>
    </button>
);

export const ContextCanvas: React.FC<ContextCanvasProps> = ({ items, onAddItem }) => {
    const [zoom, setZoom] = useState(1);
    
    const handleAddItem = (type: CanvasItem['type']) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newItem: CanvasItem = {
            id,
            type,
            content: type === 'image' ? 'https://picsum.photos/200/150' : type === 'link' ? 'https://example.com' : 'File.txt',
            x: Math.random() * 400 + 50,
            y: Math.random() * 200 + 50,
            prompt: ''
        };
        onAddItem(newItem);
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
    const handleResetZoom = () => setZoom(1);

    return (
        <div className="relative w-full h-[700px] mt-8 rounded-3xl border border-white/5 bg-[#080808] overflow-hidden shadow-2xl group mx-auto ring-1 ring-white/5">
            {/* Dark Technical Grid */}
            <div className="absolute inset-0 opacity-20" 
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #333 1px, transparent 1px),
                        linear-gradient(to bottom, #333 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center'
                }} 
            />
            
            {/* Minimal Floating Dock */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
                <div className="flex items-center gap-1 p-1.5 bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                    <MinimalDockItem icon={Image} label="Upload Image" onClick={() => handleAddItem('image')} />
                    <MinimalDockItem icon={FileText} label="Upload File" onClick={() => handleAddItem('file')} />
                    <MinimalDockItem icon={LinkIcon} label="Add Link" onClick={() => handleAddItem('link')} />
                    <div className="w-px h-5 bg-white/10 mx-1.5" />
                    <MinimalDockItem icon={PenTool} label="Pen" onClick={() => console.log("Pen")} />
                    <MinimalDockItem icon={Shapes} label="Shapes" onClick={() => handleAddItem('shape')} />
                    <MinimalDockItem icon={Eraser} label="Eraser" onClick={() => console.log("Eraser")} />
                </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 right-6 flex items-center gap-2 z-30">
                 <div className="flex items-center gap-1 p-1 bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg">
                    <button onClick={handleZoomOut} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"><ZoomOut size={16} /></button>
                    <span className="text-[10px] font-mono text-neutral-500 w-8 text-center select-none">{Math.round(zoom * 100)}%</span>
                    <button onClick={handleZoomIn} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"><ZoomIn size={16} /></button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button onClick={handleResetZoom} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"><Maximize size={16} /></button>
                 </div>
            </div>

            {/* Top Right Status */}
            <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121212]/50 backdrop-blur-md rounded-full border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-neutral-400">Context Active</span>
                </div>
            </div>

            {/* Canvas Content Area */}
            <div className="relative w-full h-full overflow-hidden">
                <motion.div 
                    className="w-full h-full p-4"
                    animate={{ scale: zoom }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    <AnimatePresence>
                        {items.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, x: item.x, y: item.y }}
                                drag
                                dragMomentum={false}
                                className="absolute flex flex-col gap-2 p-2.5 bg-[#141414] border border-neutral-800 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] w-64 cursor-grab active:cursor-grabbing z-10 hover:border-neutral-700 transition-colors"
                            >
                                <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-neutral-700" />
                                        <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">ID: {item.id.slice(0,4)}</span>
                                    </div>
                                    <MoreHorizontal size={14} className="text-neutral-500 cursor-pointer hover:text-white" />
                                </div>
                                
                                {item.type === 'image' && (
                                    <img src={item.content as string} alt="Upload" className="w-full h-32 object-cover rounded-lg border border-neutral-800 pointer-events-none opacity-90 hover:opacity-100 transition-opacity" />
                                )}
                                {item.type === 'file' && (
                                    <div className="w-full h-20 bg-neutral-900 rounded-lg flex items-center justify-center border border-dashed border-neutral-800 group-hover:border-neutral-700 transition-colors">
                                        <FileText className="text-neutral-600" />
                                    </div>
                                )}
                                {item.type === 'shape' && (
                                    <div className="w-full h-20 border-2 border-neutral-700 rounded-lg bg-neutral-900" />
                                )}
                                
                                <textarea 
                                    placeholder="Add context..."
                                    className="w-full bg-[#1A1A1A] text-xs text-white p-3 rounded-lg border border-transparent focus:border-neutral-700 focus:bg-neutral-900 outline-none resize-none h-20 placeholder-neutral-600 transition-all"
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {items.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-neutral-600 text-sm flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-white/5 rounded-full blur-xl" />
                                    <div className="relative p-6 rounded-full bg-[#121212] border border-neutral-800">
                                        <Grid className="opacity-20" size={32} />
                                    </div>
                                </div>
                                <span className="opacity-40 font-medium tracking-wide">Canvas Empty</span>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};