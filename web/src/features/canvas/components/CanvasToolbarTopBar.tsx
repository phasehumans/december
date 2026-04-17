import React from 'react'
import {
    Image as ImageIcon,
    Globe,
    MousePointer2,
    Square,
    Type as TextIcon,
    Pen,
    Eraser,
    ArrowRight,
    Hand,
    Frame,
} from 'lucide-react'

import { ToolButton } from './ToolButton'

interface CanvasToolbarTopBarProps {
    activeTool: string
    isWebClipPopoverOpen: boolean
    onSelectTool: (tool: string) => void
    onUploadImage: () => void
    onToggleWebClipPopover: () => void
    onOpenHelp: () => void
    webClipButtonRef: React.Ref<HTMLButtonElement>
}

interface ToolbarAction {
    icon: React.ComponentType<{
        className?: string
        size?: number | string
        strokeWidth?: number | string
    }>
    label: string
    onClick: () => void
    isActive?: boolean
}

const renderGroup = (actions: ToolbarAction[], wrapperClass = '') => {
    return (
        <div className={wrapperClass || 'flex items-center gap-0.5'}>
            {actions.map((action) => (
                <ToolButton
                    key={action.label}
                    icon={action.icon}
                    label={action.label}
                    onClick={action.onClick}
                    isActive={action.isActive}
                />
            ))}
        </div>
    )
}

export const CanvasToolbarTopBar: React.FC<CanvasToolbarTopBarProps> = ({
    activeTool,
    isWebClipPopoverOpen,
    onSelectTool,
    onUploadImage,
    onToggleWebClipPopover,
    onOpenHelp,
    webClipButtonRef,
}) => {
    const navigationActions: ToolbarAction[] = [
        {
            icon: MousePointer2,
            label: 'Selector',
            onClick: () => onSelectTool('select'),
            isActive: activeTool === 'select',
        },
        {
            icon: Hand,
            label: 'Pan Tool',
            onClick: () => onSelectTool('hand'),
            isActive: activeTool === 'hand',
        },
    ]

    const drawingActions: ToolbarAction[] = [
        {
            icon: Frame,
            label: 'Frame Tool',
            onClick: () => onSelectTool('frame'),
            isActive: activeTool === 'frame',
        },
        {
            icon: Pen,
            label: 'Pen Tool',
            onClick: () => onSelectTool('pen'),
            isActive: activeTool === 'pen',
        },
        {
            icon: Eraser,
            label: 'Eraser Tool',
            onClick: () => onSelectTool('eraser'),
            isActive: activeTool === 'eraser',
        },
    ]

    const shapeActions: ToolbarAction[] = [
        {
            icon: Square,
            label: 'Rectangle',
            onClick: () => onSelectTool('square'),
            isActive: activeTool === 'square',
        },
        {
            icon: ArrowRight,
            label: 'Arrow',
            onClick: () => onSelectTool('arrow'),
            isActive: activeTool === 'arrow',
        },
        {
            icon: TextIcon,
            label: 'Text',
            onClick: () => onSelectTool('text'),
            isActive: activeTool === 'text',
        },
    ]

    return (
        <div className="pointer-events-auto flex items-center gap-1 p-1 bg-[#171615] border border-white/10 rounded-lg ring-1 ring-white/5 max-w-full overflow-x-auto no-scrollbar">
            {renderGroup(navigationActions, 'flex items-center gap-0.5 pl-0.5')}
            <div className="w-px h-5 bg-white/10 mx-1" />
            <div className="flex items-center gap-0.5">
                <ToolButton icon={ImageIcon} label="Upload Image" onClick={onUploadImage} />
                <ToolButton
                    icon={Globe}
                    label="Upload Website"
                    onClick={onToggleWebClipPopover}
                    isActive={isWebClipPopoverOpen}
                    buttonRef={webClipButtonRef}
                />
            </div>
            <div className="w-px h-5 bg-white/10 mx-1" />
            {renderGroup(drawingActions)}
            <div className="w-px h-5 bg-white/10 mx-1" />
            {renderGroup(shapeActions, 'flex items-center gap-0.5 pr-0.5')}
        </div>
    )
}
