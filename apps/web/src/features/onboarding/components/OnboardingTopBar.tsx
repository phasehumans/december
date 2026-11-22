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
    'inline-flex items-center gap-1 h-7 rounded-md border border-transparent text-xs text-[#8a8a8a] hover:text-[#EDEDED] hover:bg-[#1e1e1e] hover:border-[#2A2A2A] transition-colors cursor-pointer outline-none focus-visible:border-[#87b2f4]'

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
            className={`${navClass} justify-self-start pl-1.5 pr-2.5 ${
                stepIndex === 0 ? 'invisible' : ''
            }`}
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

        <button
            type="button"
            onClick={onSkip}
            className={`${navClass} justify-self-end pl-2.5 pr-1.5`}
        >
            Skip
            <ChevronRight size={14} strokeWidth={2} />
        </button>
    </div>
)
