import React from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedControlOption<T> {
  value: T
  label?: string
  icon?: React.ElementType
}

interface SegmentedControlProps<T> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'flex bg-[#1A1A1A] rounded-lg p-1 border border-white/5',
        className
      )}
    >
      {options.map((option) => {
        const isActive = value === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200',
              isActive
                ? 'bg-[#2A2A2A] text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
            title={option.label}
          >
            {Icon && <Icon size={14} />}
            {option.label && <span>{option.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
