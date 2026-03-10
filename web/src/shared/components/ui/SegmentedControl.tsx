import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'

interface SegmentedControlOption<T> {
    value: T
    label?: string
    icon?: React.ElementType
}

interface SegmentedControlProps<T> {
    value: T
    onChange: (value: T) => void
    options: SegmentedControlOption<T>[]
    className?: string
}

export const SegmentedControl = <T extends string>({
    value,
    onChange,
    options,
    className,
}: SegmentedControlProps<T>) => {
    return (
        <div className={cn('flex p-1 bg-[#1C1C1E] rounded-lg border border-white/5', className)}>
            {options.map((option) => {
                const isSelected = value === option.value
                const Icon = option.icon

                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'relative flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all z-10',
                            isSelected ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
                        )}
                    >
                        {isSelected && (
                            <motion.div
                                layoutId="segmented-control-highlight"
                                className="absolute inset-0 bg-[#2C2C2E] rounded-md shadow-sm -z-10"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                        )}
                        {Icon && <Icon size={14} />}
                        {option.label && <span>{option.label}</span>}
                    </button>
                )
            })}
        </div>
    )
}
