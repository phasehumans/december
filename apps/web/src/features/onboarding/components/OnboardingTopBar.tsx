import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'

interface OnboardingTopBarProps {
    stepIndex: number
    stepCount: number
    onBack: () => void
    onSkip: () => void
    isWide?: boolean
}

const navClass =
    'inline-flex items-center gap-1 h-11 -my-2 px-2 -mx-2 text-xs text-[#8a8a8a] hover:text-[#EDEDED] focus-visible:text-[#EDEDED] focus-visible:underline underline-offset-4 transition-colors cursor-pointer outline-none'

export const OnboardingTopBar: React.FC<OnboardingTopBarProps> = ({
    stepIndex,
    stepCount,
    onBack,
    onSkip,
    isWide = false,
}) => (
    <div
        className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 w-full mx-auto ${
            isWide ? 'max-w-[600px]' : 'max-w-[340px]'
        }`}
    >
        <button
            type="button"
            onClick={onBack}
            className={`${navClass} justify-self-start ${stepIndex === 0 ? 'invisible' : ''}`}
            aria-hidden={stepIndex === 0}
            tabIndex={stepIndex === 0 ? -1 : 0}
        >
            <ChevronLeft size={14} strokeWidth={2} />
            Back
        </button>

        <div
            className="flex gap-1"
            role="progressbar"
            aria-label={`Step ${stepIndex + 1} of ${stepCount}`}
            aria-valuemin={1}
            aria-valuemax={stepCount}
            aria-valuenow={stepIndex + 1}
        >
            {Array.from({ length: stepCount }, (_, index) => (
                <span
                    key={index}
                    className={`h-[3px] w-7 rounded-full ${
                        index <= stepIndex ? 'bg-[#EDEDED]' : 'bg-[#2c2c2c]'
                    }`}
                />
            ))}
        </div>

        <button type="button" onClick={onSkip} className={`${navClass} justify-self-end`}>
            Skip
            <ChevronRight size={14} strokeWidth={2} />
        </button>
    </div>
)
