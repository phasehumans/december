import { motion } from 'framer-motion'
import { Type as TextIcon } from 'lucide-react'
import React from 'react'

import { CanvasDeleteButton } from './CanvasDeleteButton'
import { CanvasFrameItem } from './CanvasFrameItem'
import { CanvasResizeHandles } from './CanvasResizeHandles'
import { CanvasVectorItem } from './CanvasVectorItem'

import type { CanvasItemComponentProps } from '@/features/canvas/types'

import {
    useCanvasItemController,
    TEXT_FONT_SIZE,
    TEXT_FONT,
    measureTextDimensions,
} from '@/features/canvas/hooks/useCanvasItemController'
import { cn } from '@/shared/lib/utils'

export const CanvasItemComponent: React.FC<CanvasItemComponentProps> = ({
    item,
    isSelected,
    onSelect,
    onRemove,
    onDragging,
    onDragStart,
    onDragEnd,
    onConnectStart,
    onConnectEnd,
    onUpdate,
    onUpdateEnd,
    scale,
    activeTool,
}) => {
    const {
        isChild,
        isEditing,
        setIsEditing,
        isSelectMode,
        canTransform,
        startShapeResize,
        startLineHandleDrag,
        handlePointerDown,
        linePath,
        lineStart,
        lineEnd,
        penPath,
        showShapeResizeHandles,
        showLineHandles,
        showSelectionContainer,
    } = useCanvasItemController({
        item,
        isSelected,
        onSelect,
        onUpdate,
        onUpdateEnd,
        onDragStart,
        onDragging,
        onDragEnd,
        scale,
        activeTool,
    })

    return (
        <motion.div
            initial={false}
            animate={{ x: item.x, y: item.y }}
            transition={{ type: 'tween', duration: 0 }}
            onPointerDown={handlePointerDown}
            onClick={(e) => e.stopPropagation()}
            style={{
                width: item.width,
                height: item.height,
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: isChild ? 20 : 10,
            }}
            className={cn(
                'group outline-none select-none',
                !isChild && isSelectMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                item.type === 'note' && !item.width && 'w-64',

                item.type === 'link' && !item.width && 'w-[480px]',
                item.type === 'image' && !item.width && 'w-80 h-72',
                item.type === 'frame' && !item.width && 'w-96 h-96',
                (item.type === 'square' || item.type === 'circle') && !item.width && 'w-32 h-32',
                (item.type === 'line' || item.type === 'arrow') &&
                    !item.width &&
                    'w-48 h-12 flex items-center',
                item.type === 'pen' && !item.width && 'w-48 h-24'
            )}
        >
            {showSelectionContainer && (
                <div
                    className={cn(
                        'absolute -inset-[3px] rounded-2xl border transition-all duration-200 pointer-events-none z-0',
                        isSelected
                            ? 'border-neutral-400/50 opacity-100'
                            : 'border-transparent opacity-0 group-hover:opacity-100 group-hover:border-white/10'
                    )}
                />
            )}

            <div className="relative z-10 h-full w-full">
                {item.type === 'note' && (
                    <div className="relative overflow-hidden rounded-xl border border-neutral-200/50 bg-[#FEF9C3] text-neutral-900 shadow-xl">
                        <CanvasDeleteButton onRemove={onRemove} />
                        <div className="flex min-h-[160px] flex-col p-4">
                            <textarea
                                placeholder="Type text..."
                                className="h-full w-full resize-none border-none bg-transparent text-sm font-medium leading-relaxed text-neutral-900 outline-none placeholder-neutral-500/50"
                                autoFocus
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                            <div className="mt-auto flex items-center gap-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500 opacity-50">
                                <TextIcon size={10} />
                                Text
                            </div>
                        </div>
                    </div>
                )}

                {item.type === 'text' &&
                    (isEditing ? (
                        <textarea
                            value={item.content || ''}
                            autoFocus
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    e.preventDefault()
                                    e.currentTarget.blur()
                                }
                                e.stopPropagation()
                            }}
                            onChange={(e) => {
                                const value = e.target.value
                                const dims = measureTextDimensions(value)
                                if (onUpdate) {
                                    onUpdate(
                                        { content: value, width: dims.width, height: dims.height },
                                        { commitHistory: false }
                                    )
                                }
                            }}
                            onBlur={(e) => {
                                const value = e.target.value
                                if (!value.trim()) {
                                    onRemove()
                                    return
                                }
                                const dims = measureTextDimensions(value)
                                if (onUpdate) {
                                    onUpdate({
                                        content: value,
                                        width: dims.width,
                                        height: dims.height,
                                    })
                                }
                                setIsEditing(false)
                            }}
                            style={{
                                fontSize: `${TEXT_FONT_SIZE}px`,
                                lineHeight: 1.5,
                                fontFamily: TEXT_FONT,
                                fontWeight: 500,
                                padding: '4px',
                            }}
                            className="h-full w-full resize-none border-none bg-transparent text-[#E8E8E6] outline-none caret-white whitespace-pre overflow-hidden"
                        />
                    ) : (
                        <div
                            onDoubleClick={(e) => {
                                e.stopPropagation()
                                setIsEditing(true)
                            }}
                            style={{
                                fontSize: `${TEXT_FONT_SIZE}px`,
                                lineHeight: 1.5,
                                fontFamily: TEXT_FONT,
                                fontWeight: 500,
                                padding: '4px',
                            }}
                            className="h-full w-full select-none text-[#E8E8E6] whitespace-pre overflow-hidden cursor-default"
                        >
                            {item.content}
                        </div>
                    ))}

                {item.type === 'image' && (
                    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[#2E2D2C] bg-[#141414] transition-colors group-hover:border-[#454443]">
                        {!isChild && <CanvasDeleteButton onRemove={onRemove} />}
                        <div className="relative h-[65%] w-full overflow-hidden border-b border-[#2E2D2C] bg-[#141312] group/img">
                            <img
                                src={item.content}
                                alt=""
                                className="h-full w-full object-cover opacity-90 transition-opacity duration-300 group-hover/img:opacity-100"
                                draggable={false}
                            />
                            {isChild && <div className="absolute inset-0 bg-transparent" />}
                        </div>
                        <div className="flex flex-1 flex-col bg-[#141414] p-3.5">
                            <textarea
                                className="h-full w-full resize-none bg-transparent text-[13px] leading-relaxed text-[#D6D5D4] placeholder-[#656565] focus:outline-none font-medium"
                                placeholder="Describe how to use this image..."
                                onKeyDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )}

                {item.type === 'link' && (
                    <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/10 bg-[#252423]">
                        <CanvasDeleteButton onRemove={onRemove} />
                        <span className="text-xs text-neutral-500">{item.content}</span>
                    </div>
                )}

                {item.type === 'frame' && (
                    <CanvasFrameItem
                        item={item}
                        isSelected={isSelected}
                        isDropdownOpen={isDropdownOpen}
                        setIsDropdownOpen={setIsDropdownOpen}
                        onRemove={onRemove}
                        onUpdate={onUpdate}
                        onUpdateEnd={onUpdateEnd}
                        onConnectStart={onConnectStart}
                        onConnectEnd={onConnectEnd}
                    />
                )}

                <CanvasVectorItem
                    item={item}
                    isSelected={isSelected}
                    linePath={linePath}
                    penPath={penPath}
                />

                <CanvasResizeHandles
                    showShapeResizeHandles={showShapeResizeHandles}
                    showLineHandles={showLineHandles}
                    lineStart={lineStart}
                    lineEnd={lineEnd}
                    onShapeHandleDown={startShapeResize}
                    onLineHandleDown={startLineHandleDrag}
                />
            </div>
        </motion.div>
    )
}
