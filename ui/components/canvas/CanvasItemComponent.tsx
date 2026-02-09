import React from 'react';
import { motion } from 'framer-motion';
import { X, Text as TextIcon, Globe, Box, Circle, ArrowRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CanvasItem } from '@/types';

interface CanvasItemComponentProps {
  item: CanvasItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export const CanvasItemComponent: React.FC<CanvasItemComponentProps> = ({
  item,
  isSelected,
  onSelect,
  onRemove,
}) => {
  // Quick Delete Button Component
  const DeleteButton = () => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="absolute -top-3 -right-3 bg-black border border-white/10 text-neutral-400 hover:text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all z-50 hover:bg-neutral-800 hover:border-white/20 shadow-xl scale-75 hover:scale-100"
      title="Remove item"
    >
      <X size={12} strokeWidth={2.5} />
    </button>
  );

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, x: item.x, y: item.y }}
      exit={{ scale: 0.9, opacity: 0 }}
      drag
      dragMomentum={false}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
          width: item.width,
          height: item.height
      }}
      className={cn(
        'absolute cursor-grab active:cursor-grabbing z-20 group outline-none',
        // Default sizes if width/height not provided in item
        item.type === 'note' && !item.width && 'w-64',
        item.type === 'link' && !item.width && 'w-[480px]',
        item.type === 'image' && !item.width && 'w-80',
        item.type === 'frame' && !item.width && 'w-96 h-96',
        (item.type === 'square' || item.type === 'circle') && !item.width && 'w-32 h-32',
        (item.type === 'line' || item.type === 'arrow') && !item.width && 'w-48 h-12 flex items-center',
      )}
    >
      {/* Selection Outline */}
      <div
        className={cn(
          'absolute -inset-[4px] rounded-xl border-2 transition-all duration-200 pointer-events-none z-0',
          isSelected
            ? 'border-white/20' // Simple white border, no glow
            : 'border-transparent group-hover:border-white/10'
        )}
      />

      <div className="relative z-10 w-full h-full">
        {/* Note Item */}
        {item.type === 'note' && (
          <div className="relative overflow-hidden shadow-xl bg-[#FEF9C3] text-neutral-900 rounded-xl border border-neutral-200/50">
            <DeleteButton />
            <div className="p-4 min-h-[160px] flex flex-col">
              <textarea
                placeholder="Type text..."
                className="w-full h-full bg-transparent border-none outline-none resize-none text-sm font-medium placeholder-neutral-500/50 leading-relaxed text-neutral-900"
                autoFocus
              />
              <div className="mt-auto text-[10px] text-neutral-500 font-medium uppercase tracking-wider opacity-50 pt-2 flex items-center gap-1">
                <TextIcon size={10} />
                Text
              </div>
            </div>
          </div>
        )}

        {/* Image Item */}
        {item.type === 'image' && (
          <div className="bg-[#1C1C1E] rounded-xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <DeleteButton />
            <div className="relative aspect-video bg-neutral-900 w-full overflow-hidden">
              <img
                src={item.content}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            <div className="p-1 bg-[#1C1C1E] border-t border-white/5">
              <textarea
                placeholder="Describe how to use this image..."
                className="w-full bg-[#141414] text-xs text-neutral-300 px-3 py-2 rounded-lg border border-transparent focus:border-white/5 outline-none transition-all placeholder-neutral-600 resize-none min-h-[60px]"
              />
            </div>
          </div>
        )}

        {/* Link Item */}
        {item.type === 'link' && (
          <div className="bg-[#1C1C1E] rounded-xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <DeleteButton />
            <div className="h-8 bg-[#2A2A2D] border-b border-white/5 flex items-center px-3 gap-2">
               <Globe size={12} className="text-neutral-500" />
               <span className="text-[10px] text-neutral-400 truncate">{item.content}</span>
            </div>
            <div className="relative w-full h-[240px] bg-white">
              <iframe
                src={item.content}
                className="w-full h-full border-0 pointer-events-none select-none opacity-90"
                title="Website Preview"
              />
              <div className="absolute inset-0 bg-transparent" />
            </div>
            <div className="p-1 bg-[#1C1C1E] border-t border-white/5">
              <textarea
                placeholder="Describe what to use from this website..."
                className="w-full bg-[#141414] text-xs text-neutral-300 px-3 py-2 rounded-lg border border-transparent focus:border-white/5 outline-none transition-all placeholder-neutral-600 resize-none min-h-[60px]"
              />
            </div>
          </div>
        )}

        {/* Frame */}
        {item.type === 'frame' && (
            <div className="w-full h-full border-2 border-dashed border-white/20 rounded-xl bg-white/[0.02] flex flex-col">
                <DeleteButton />
                <div className="px-3 py-1.5 border-b border-white/10 text-[10px] text-neutral-500 font-mono uppercase tracking-wider flex items-center gap-2">
                    <Box size={10} />
                    Frame
                </div>
            </div>
        )}

        {/* Square */}
        {item.type === 'square' && (
            <div className="w-full h-full bg-[#262626] border border-white/10 rounded-2xl shadow-lg flex items-center justify-center">
                 <DeleteButton />
                 <Box className="text-white/10 w-1/3 h-1/3" />
            </div>
        )}

        {/* Circle */}
        {item.type === 'circle' && (
            <div className="w-full h-full bg-[#262626] border border-white/10 rounded-full shadow-lg flex items-center justify-center">
                 <DeleteButton />
                 <Circle className="text-white/10 w-1/3 h-1/3" />
            </div>
        )}

        {/* Line */}
        {item.type === 'line' && (
             <div className="w-full flex items-center justify-center">
                <DeleteButton />
                <div className="w-full h-1 bg-white rounded-full" />
            </div>
        )}

        {/* Arrow */}
        {item.type === 'arrow' && (
            <div className="w-full flex items-center">
                <DeleteButton />
                <div className="flex-1 h-1 bg-white rounded-l-full" />
                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white" />
            </div>
        )}

      </div>
    </motion.div>
  );
};