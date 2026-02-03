import React, { useState, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Maximize2, 
  X,
  Move,
  Trash2,
  Plus,
  StickyNote,
  Undo2,
  Redo2,
  MousePointer2,
  Square,
  Type as TextIcon,
  Minus,
  Upload,
  Pen,
  Eraser,
  Circle,
  ArrowRight,
  ExternalLink,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CanvasItem } from '@/types';
import { cn } from '@/lib/utils';

interface ContextCanvasProps {
    items: CanvasItem[];
    onAddItem: (item: CanvasItem) => void;
    onRemoveItem?: (id: string) => void;
}

const ToolButton = ({ icon: Icon, label, onClick, active }: { icon: any, label: string, onClick: () => void, active?: boolean }) => (
    <button 
        onClick={onClick}
        className={cn(
            "group relative p-2.5 rounded-xl transition-all duration-200 border border-transparent",
            active 
                ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]" 
                : "text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/5"
        )}
        title={label}
    >
        <Icon size={18} strokeWidth={2} />
    </button>
);

export const ContextCanvas: React.FC<ContextCanvasProps> = ({ items, onAddItem, onRemoveItem }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [scale, setScale] = useState(100);
    const [activeTool, setActiveTool] = useState<string>('select');
    
    const handleAddItem = (type: CanvasItem['type']) => {
        const id = Math.random().toString(36).substr(2, 9);
        const colors = ['#262626', '#171717', '#1F1F1F'];
        
        const newItem: CanvasItem = {
            id,
            type,
            content: type === 'image' 
                ? 'https://images.unsplash.com/photo-1605379399642-870262d3d051?q=80&w=3272&auto=format&fit=crop' 
                : type === 'link' 
                    ? 'https://example.com' 
                    : '',
            x: Math.random() * 300 + 200,
            y: Math.random() * 200 + 100,
            prompt: '',
            color: type === 'note' ? '#FEF08A' : colors[Math.floor(Math.random() * colors.length)]
        };
        onAddItem(newItem);
        setActiveTool('select');
    };

    return (
        <div className="w-full flex flex-col items-center">
            {/* Main Canvas Area */}
            <div 
                ref={containerRef}
                className="relative w-full h-[850px] bg-[#141415] rounded-3xl border border-white/10 shadow-2xl overflow-hidden group ring-1 ring-white/5 select-none"
                onClick={() => setSelectedId(null)}
            >
                {/* Dotted Grid Background - Subtle White/Grey Dots */}
                <div 
                    className="absolute inset-0 pointer-events-none opacity-20" 
                    style={{
                        backgroundImage: 'radial-gradient(#888 1.5px, transparent 1.5px)',
                        backgroundSize: '24px 24px'
                    }} 
                />
                
                {/* Ambient Dark Glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0)_100%)] pointer-events-none" />

                {/* Top Bar Navigation & Toolbar */}
                <div className="absolute top-6 left-6 right-6 flex items-start justify-between z-40 pointer-events-none">
                    {/* Left: Project Info */}
                    <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-lg hover:border-white/20 transition-colors">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs text-white font-medium opacity-90 tracking-wide">Context Canvas</span>
                    </div>

                    {/* Center: Toolbar */}
                    <div className="pointer-events-auto flex items-center gap-1 p-1.5 bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 hover:bg-[#0A0A0A] transition-colors">
                        {/* Selector */}
                        <ToolButton 
                            icon={MousePointer2} 
                            label="Selector" 
                            onClick={() => setActiveTool('select')} 
                            active={activeTool === 'select'} 
                        />
                        
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        
                        {/* Uploads */}
                        <ToolButton icon={ImageIcon} label="Upload Image" onClick={() => handleAddItem('image')} />
                        <ToolButton icon={LinkIcon} label="Upload Website" onClick={() => handleAddItem('link')} />
                        
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        
                        {/* Draw Tools */}
                        <ToolButton 
                            icon={Pen} 
                            label="Pen Tool" 
                            onClick={() => setActiveTool('pen')} 
                            active={activeTool === 'pen'} 
                        />
                        <ToolButton 
                            icon={Eraser} 
                            label="Eraser Tool" 
                            onClick={() => setActiveTool('eraser')} 
                            active={activeTool === 'eraser'} 
                        />
                        
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        
                        {/* Shapes */}
                        <ToolButton 
                            icon={Square} 
                            label="Square" 
                            onClick={() => setActiveTool('square')} 
                            active={activeTool === 'square'} 
                        />
                        <ToolButton 
                            icon={Circle} 
                            label="Circle" 
                            onClick={() => setActiveTool('circle')} 
                            active={activeTool === 'circle'} 
                        />
                        <ToolButton 
                            icon={ArrowRight} 
                            label="Arrow" 
                            onClick={() => setActiveTool('arrow')} 
                            active={activeTool === 'arrow'} 
                        />
                         <ToolButton 
                            icon={Minus} 
                            label="Line" 
                            onClick={() => setActiveTool('line')} 
                            active={activeTool === 'line'} 
                        />
                        
                        <div className="w-px h-6 bg-white/10 mx-1" />

                        {/* Text */}
                        <ToolButton icon={TextIcon} label="Text" onClick={() => handleAddItem('note')} />

                        <div className="w-px h-6 bg-white/10 mx-1" />

                        {/* Redirect */}
                        <ToolButton 
                            icon={ExternalLink} 
                            label="Open New Tab" 
                            onClick={() => window.open(window.location.href, '_blank')} 
                        />
                    </div>

                    {/* Right: Controls (Undo/Redo & Zoom) */}
                    <div className="pointer-events-auto flex items-center gap-3">
                        {/* Undo/Redo */}
                        <div className="flex items-center p-1 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg">
                            <button className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors">
                                <Undo2 size={16} />
                            </button>
                            <div className="w-px h-4 bg-white/10" />
                            <button className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors">
                                <Redo2 size={16} />
                            </button>
                        </div>

                        {/* Zoom */}
                        <div className="flex items-center p-1 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg gap-1">
                             <button 
                                onClick={() => setScale(s => Math.max(25, s - 25))}
                                className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="text-xs font-mono text-neutral-300 w-10 text-center select-none">{scale}%</span>
                            <button 
                                onClick={() => setScale(s => Math.min(200, s + 25))}
                                className="p-2.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Canvas Items Layer - Scaled */}
                <div className="relative w-full h-full overflow-hidden">
                    <motion.div 
                        className="w-full h-full absolute inset-0"
                        animate={{ scale: scale / 100 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                        style={{ transformOrigin: "center center" }}
                    >
                        <AnimatePresence mode="popLayout">
                            {items.map((item) => (
                                <CanvasItemComponent 
                                    key={item.id} 
                                    item={item} 
                                    isSelected={selectedId === item.id}
                                    onSelect={() => setSelectedId(item.id)}
                                    onRemove={() => onRemoveItem?.(item.id)}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

interface CanvasItemComponentProps {
    item: CanvasItem;
    isSelected: boolean;
    onSelect: () => void;
    onRemove: () => void;
}

const CanvasItemComponent: React.FC<CanvasItemComponentProps> = ({ 
    item, 
    isSelected, 
    onSelect,
    onRemove 
}) => {
    
    // Quick Delete Button Component
    const DeleteButton = () => (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onRemove();
            }}
            className="absolute top-2 right-2 bg-black/50 border border-white/10 text-neutral-400 hover:text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all z-50 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 shadow-xl backdrop-blur-md"
            title="Remove item"
        >
            <X size={12} strokeWidth={2.5} />
        </button>
    );

    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, x: item.x, y: item.y }}
            exit={{ scale: 0.9, opacity: 0 }}
            drag
            dragMomentum={false}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={cn(
                "absolute flex flex-col cursor-grab active:cursor-grabbing z-20 group outline-none",
                item.type === 'note' ? "w-64" : item.type === 'link' ? "w-[480px]" : "w-80"
            )}
        >
            {/* Selection Outline */}
            <div className={cn(
                "absolute -inset-[2px] rounded-2xl border-2 transition-all duration-200 pointer-events-none",
                isSelected 
                    ? "border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                    : "border-transparent group-hover:border-white/10"
            )} />

            {/* Content Container */}
            <div className="relative shadow-2xl rounded-xl">
                
                {/* Note Item */}
                {item.type === 'note' && (
                    <div className={cn(
                        "relative overflow-hidden shadow-sm transition-shadow bg-[#FEF9C3] text-neutral-900 rounded-bl-sm rounded-xl border border-neutral-200"
                    )}>
                        <DeleteButton />
                        <div className="p-4 min-h-[180px] flex flex-col">
                            <textarea 
                                placeholder="Type text..."
                                className="w-full h-full bg-transparent border-none outline-none resize-none text-sm font-medium placeholder-neutral-500/50 leading-relaxed text-neutral-900"
                                autoFocus
                            />
                            <div className="mt-auto text-[10px] text-neutral-500 font-medium uppercase tracking-wider opacity-50 pt-2 flex items-center gap-1">
                                <TextIcon size={10} />
                                Text Block
                            </div>
                        </div>
                    </div>
                )}

                {/* Image Item */}
                {item.type === 'image' && (
                    <div className="bg-[#1C1C1E] rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                        <DeleteButton />
                        
                        {/* Image Preview */}
                        <div className="relative aspect-video bg-neutral-900 w-full overflow-hidden">
                            <img 
                                src={item.content as string} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                draggable={false}
                            />
                            {/* Overlay for selection when dragging */}
                            <div className="absolute inset-0 bg-transparent" />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-[#1C1C1E] border-t border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Context</span>
                            </div>
                            <textarea 
                                placeholder="Describe how to use this image..."
                                className="w-full bg-[#141414] text-xs text-white px-3 py-2 rounded-lg border border-white/5 focus:border-white/10 focus:bg-[#2A2A2D] outline-none transition-colors placeholder-neutral-600 resize-none min-h-[60px]"
                            />
                        </div>
                    </div>
                )}

                {/* Link/Website Item */}
                {item.type === 'link' && (
                    <div className="bg-[#1C1C1E] rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                        <DeleteButton />
                        
                        {/* Mini Browser Header */}
                        <div className="h-9 bg-[#2A2A2D] border-b border-white/5 flex items-center px-4 gap-3">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="flex items-center gap-2 bg-[#141414] border border-white/5 rounded-md px-3 py-0.5 max-w-[240px] w-full">
                                    <Globe size={10} className="text-neutral-500" />
                                    <span className="text-[10px] text-neutral-400 font-mono truncate w-full text-center opacity-80 select-none">
                                        {item.content as string}
                                    </span>
                                </div>
                            </div>
                            <div className="w-10" /> {/* Spacer for balance */}
                        </div>

                        {/* Website Iframe Preview */}
                        <div className="relative w-full h-[300px] bg-white">
                            <iframe 
                                src={item.content as string} 
                                className="w-full h-full border-0 pointer-events-none select-none opacity-90"
                                title="Website Preview"
                            />
                            {/* Drag Overlay */}
                            <div className="absolute inset-0 bg-transparent z-10" />
                        </div>

                        {/* Input Area */}
                         <div className="p-3 bg-[#1C1C1E] border-t border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Website Context</span>
                            </div>
                             <textarea 
                                placeholder="Describe what to use from this site..."
                                className="w-full bg-[#141414] text-xs text-white px-3 py-2 rounded-lg border border-white/5 focus:border-white/10 focus:bg-[#2A2A2D] outline-none transition-colors placeholder-neutral-600 resize-none min-h-[60px]"
                            />
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};