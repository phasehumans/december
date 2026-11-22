import { Check, ChevronDown, Search } from 'lucide-react'
import React from 'react'

import type { ByokProvider } from '@/features/profile/api/byok'

interface OnboardingProviderPickerProps {
    providers: ByokProvider[]
    value: string
    onChange: (providerId: string) => void
    disabled?: boolean
}

/** provider field for step 3: looks like a sign-up input, opens a searchable list */
export const OnboardingProviderPicker: React.FC<OnboardingProviderPickerProps> = ({
    providers,
    value,
    onChange,
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const listId = React.useId()

    const selected = providers.find((provider) => provider.id === value)

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        return q
            ? providers.filter(
                  (provider) =>
                      provider.name.toLowerCase().includes(q) ||
                      provider.id.toLowerCase().includes(q)
              )
            : providers
    }, [providers, query])

    const close = React.useCallback(() => {
        setIsOpen(false)
        setQuery('')
    }, [])

    // close on a click outside the picker
    React.useEffect(() => {
        if (!isOpen) return
        const handlePointer = (event: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                close()
            }
        }
        document.addEventListener('mousedown', handlePointer)
        return () => document.removeEventListener('mousedown', handlePointer)
    }, [isOpen, close])

    const pick = (providerId: string) => {
        onChange(providerId)
        close()
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => (isOpen ? close() : setIsOpen(true))}
                disabled={disabled || providers.length === 0}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listId}
                className={`w-full h-9 px-3 flex items-center justify-between gap-2 rounded-md border bg-[#141414] font-sans text-xs sm:text-[13px] text-left transition-colors cursor-pointer disabled:opacity-50 outline-none focus-visible:border-[#87b2f4] ${
                    isOpen ? 'border-[#3A3A3A]' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
                }`}
            >
                <span className={selected ? 'text-white' : 'text-[#666666]'}>
                    {selected?.name ??
                        (providers.length === 0 ? 'Loading providers...' : 'Provider')}
                </span>
                <ChevronDown
                    size={14}
                    className={`text-[#737373] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-md border border-[#2A2A2A] bg-[#1a1a1a] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)] overflow-hidden">
                    <div className="relative border-b border-[#262626]">
                        <Search
                            size={13}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]"
                        />
                        <input
                            type="text"
                            autoFocus
                            aria-label="Search providers"
                            placeholder={`Search ${providers.length} providers`}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') close()
                                if (event.key === 'Enter' && filtered[0]) {
                                    event.preventDefault()
                                    pick(filtered[0].id)
                                }
                            }}
                            className="w-full h-9 pl-8 pr-3 bg-transparent font-sans text-xs sm:text-[13px] text-white placeholder-[#666666] outline-none"
                        />
                    </div>
                    <div id={listId} role="listbox" className="max-h-[216px] overflow-y-auto p-1">
                        {filtered.map((provider) => {
                            const isSelected = provider.id === value
                            return (
                                <button
                                    key={provider.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => pick(provider.id)}
                                    className={`w-full h-8 px-2.5 flex items-center justify-between gap-2 rounded font-sans text-xs sm:text-[13px] text-left transition-colors cursor-pointer ${
                                        isSelected
                                            ? 'bg-[#252525] text-white'
                                            : 'text-[#d4d4d4] hover:bg-[#222222] hover:text-white'
                                    }`}
                                >
                                    <span className="truncate">{provider.name}</span>
                                    {isSelected && (
                                        <Check size={13} className="text-white shrink-0" />
                                    )}
                                </button>
                            )
                        })}
                        {filtered.length === 0 && (
                            <p className="px-2.5 py-2 font-sans text-xs text-[#737373]">
                                No provider matches.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
