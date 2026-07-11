import { describe, it, expect } from 'bun:test'
import { cn } from '@/shared/lib/utils'

describe('cn utility', () => {
    it('merges class names correctly', () => {
        const result = cn('bg-red-500', 'text-white')
        expect(result).toBe('bg-red-500 text-white')
    })

    it('handles tailwind conflicts correctly', () => {
        // twMerge should remove bg-red-500 since bg-blue-500 comes after it
        const result = cn('bg-red-500', 'bg-blue-500')
        expect(result).toBe('bg-blue-500')
    })

    it('handles conditional class names with clsx', () => {
        const condition = true
        const falseCondition = false
        const result = cn(
            'base-class',
            condition && 'truthy-class',
            falseCondition && 'falsy-class'
        )
        expect(result).toBe('base-class truthy-class')
    })

    it('handles array and object inputs', () => {
        const result = cn(['class1', 'class2'], { class3: true, class4: false })
        expect(result).toBe('class1 class2 class3')
    })
})
