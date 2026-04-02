import React from 'react'
import {
    Image as ImageIcon,
    Globe,
    MousePointer2,
    Square,
    Type as TextIcon,
    Minus,
    Pen,
    Eraser,
    ArrowRight,
    Hand,
    Frame,
    Circle,
    Info,
} from 'lucide-react'
import { ToolButton } from './ToolButton'

interface CanvasToolbarTopBarProps {
    activeTool: string
    isWebClipModalOpen: boolean
    onSelectTool: (tool: string) => void
    onUploadImage: () => void
    onOpenWebClipModal: () => void
    onOpenHelp: () => void
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
    isWebClipModalOpen,
    onSelectTool,
    onUploadImage,
    onOpenWebClipModal,
    onOpenHelp,
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

    const assetActions: ToolbarAction[] = [
        { icon: ImageIcon, label: 'Upload Image', onClick: onUploadImage },
        {
            icon: Globe,
            label: 'Upload Website',
            onClick: onOpenWebClipModal,
            isActive: isWebClipModalOpen,
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
            icon: Circle,
            label: 'Circle',
            onClick: () => onSelectTool('circle'),
            isActive: activeTool === 'circle',
        },
        {
            icon: Minus,
            label: 'Line',
            onClick: () => onSelectTool('line'),
            isActive: activeTool === 'line',
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
            {renderGroup(assetActions)}
            <div className="w-px h-5 bg-white/10 mx-1" />
            {renderGroup(drawingActions)}
            <div className="w-px h-5 bg-white/10 mx-1" />
            {renderGroup(shapeActions)}
            <div className="w-px h-5 bg-white/10 mx-1" />
            {renderGroup(
                [{ icon: Info, label: 'How to use', onClick: onOpenHelp }],
                'flex items-center gap-0.5 pr-0.5'
            )}
        </div>
    )
}
