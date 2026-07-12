import { useState } from 'react'

export function useHooks() {
    const [selectedHookType, setSelectedHookType] = useState<string | null>(null)
    const [hookMatchers, setHookMatchers] = useState<
        Record<string, { pattern: string; enabled: boolean }[]>
    >({})
    const [addingMatcher, setAddingMatcher] = useState(false)
    const [newMatcherRegex, setNewMatcherRegex] = useState('')
    const [matcherIndex, setMatcherIndex] = useState(0)

    return {
        selectedHookType,
        setSelectedHookType,
        hookMatchers,
        setHookMatchers,
        addingMatcher,
        setAddingMatcher,
        newMatcherRegex,
        setNewMatcherRegex,
        matcherIndex,
        setMatcherIndex,
    }
}
