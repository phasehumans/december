import React from 'react'
import { ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/utils'

type FeedbackType = 'like' | 'dislike' | null

interface ChatActionButtonProps {
    icon: React.ComponentType<{ size?: string | number; className?: string }>
    title: string
    isActive: boolean
    onClick: () => void
}

interface ChatMessageActionsProps {
    feedback: FeedbackType
    onFeedbackChange: (feedback: FeedbackType) => void
}

const ChatActionButton: React.FC<ChatActionButtonProps> = ({
    icon: Icon,
    title,
    isActive,
    onClick,
}) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                'p-1.5 rounded-md transition-colors',
                isActive ? 'text-white' : 'text-[#91908F] hover:text-white'
            )}
            title={title}
        >
            <Icon size={14} className={cn('transition-colors', isActive && 'fill-white')} />
        </button>
    )
}

export const ChatMessageActions: React.FC<ChatMessageActionsProps> = ({
    feedback,
    onFeedbackChange,
}) => {
    return (
        <div className="flex items-center justify-between pt-3 mt-2">
            <div className="flex items-center gap-2">
                <ChatActionButton
                    icon={ThumbsUp}
                    title="Helpful"
                    isActive={feedback === 'like'}
                    onClick={() => onFeedbackChange(feedback === 'like' ? null : 'like')}
                />
                <ChatActionButton
                    icon={ThumbsDown}
                    title="Not Helpful"
                    isActive={feedback === 'dislike'}
                    onClick={() => onFeedbackChange(feedback === 'dislike' ? null : 'dislike')}
                />
            </div>

            <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs gap-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#D4D4D8] border border-white/5 rounded-lg px-3"
            >
                <RotateCcw size={12} />
                Restore
            </Button>
        </div>
    )
}
