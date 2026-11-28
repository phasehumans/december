import { Check, ChevronDown } from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

import { SettingsPageHeader, SettingsSectionHeading } from './SettingsPageHeader'
import { sectionBoxClass } from './settingsStyles'

export { blueButtonClass, outlineButtonClass } from './settingsStyles'

import { isConnectionsDemoActive } from '@/features/connections/lib/connectionsDemo'
import { ListArt, type ListArtKind } from '@/features/sessions/components/ListParts'
import { cn } from '@/shared/lib/utils'

// shared parts for the settings pages. the pages are connected to the server. a few parts
// are not yet (a model for each step, machine size, single sign-on): they run
// on sample values in memory, behind the same preview flag as the connections tabs (?demo),
// and show the Demo pill. normal users do not see them, or see "Soon".

/** true when the preview is on for this browser (see connectionsDemo.ts) */
export const usePreviewOn = (): boolean => React.useState(isConnectionsDemoActive)[0]

interface PreviewState {
    values: Record<string, unknown>
    setValue: (key: string, value: unknown) => void
}

const usePreviewStore = create<PreviewState>((set) => ({
    values: {},
    setValue: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
}))

/** back to the sample values. for tests */
export const resetPreviewValues = (): void => usePreviewStore.setState({ values: {} })

/** one value of a ui-only setting. it is kept in memory and lasts until the page reloads */
export function usePreviewValue<T>(key: string, initial: T): [T, (value: T) => void] {
    const stored = usePreviewStore((s) => s.values[key])
    const setValue = usePreviewStore((s) => s.setValue)
    const value = (stored === undefined ? initial : stored) as T
    const set = React.useCallback((next: T) => setValue(key, next), [key, setValue])
    return [value, set]
}

/**
 * One section of a settings page: a heading with one grey line, above a rounded box that
 * holds the rows. `bare` leaves the box out, for content that is a list box already.
 */
export const SettingsSection: React.FC<{
    title?: string
    description?: React.ReactNode
    action?: React.ReactNode
    bare?: boolean
    children: React.ReactNode
}> = ({ title, description, action, bare, children }) => (
    <div className="flex flex-col">
        {title && (
            <SettingsSectionHeading title={title} description={description} action={action} />
        )}
        <div className={bare ? 'flex flex-col gap-3' : sectionBoxClass}>{children}</div>
    </div>
)

/** a settings subpage: the heading with its grey line, then the sections */
export const SettingsPage: React.FC<{
    title: string
    subtitle: React.ReactNode
    className?: string
    children: React.ReactNode
}> = ({ title, subtitle, className, children }) => (
    <div className={cn('flex flex-col w-full max-w-[772px] text-[#D6D5C9]', className)}>
        <SettingsPageHeader title={title} subtitle={subtitle} />
        <div className="flex flex-col gap-5">{children}</div>
    </div>
)

/**
 * label on the left, control on the right. a long label wraps and a short control (a switch,
 * a button) stays on its line; only a wide control drops under the label
 */
export const SettingsRow: React.FC<{
    label: React.ReactNode
    hint?: React.ReactNode
    children?: React.ReactNode
}> = ({ label, hint, children }) => (
    <div className="flex items-center justify-between gap-x-3 gap-y-2 min-h-8 flex-wrap">
        <div className="flex flex-col flex-1 basis-0 min-w-[6.5rem]">
            <span className="text-[14px] text-[#D6D5C9]">{label}</span>
            {hint && <span className="text-[13px] text-[#7B7A79]">{hint}</span>}
        </div>
        {children && <div className="flex items-center gap-2 shrink-0 max-w-full">{children}</div>}
    </div>
)

const fieldClass =
    'bg-white/[0.03] border border-[#2B2A27] rounded-lg text-[13px] text-white focus:outline-none placeholder:text-[#4A4948]'

interface SelectOption<T extends string> {
    value: T
    label: string
}

const panelClass =
    'fixed z-[10000] flex flex-col rounded-xl border border-[#2E2D2C] bg-[#1E1E1E] p-1 shadow-2xl font-sans text-left max-h-[280px] overflow-y-auto no-scrollbar'
const optionClass =
    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[#D6D5C9] whitespace-nowrap transition-colors hover:bg-[#2A2A2A] hover:text-white focus-visible:bg-[#2A2A2A] focus-visible:text-white outline-none cursor-pointer'

/**
 * The one dropdown of the settings pages: a button with the picked value, and a menu in the
 * look of the Sessions sort menu. The menu is drawn over the page (so a dialog does not cut
 * it), opens under the button or above it when there is no room, and works with the keys
 * (arrows, Home, End, Enter, Escape).
 */
export function SettingsSelect<T extends string>({
    label,
    value,
    options,
    onChange,
    className,
    disabled,
    size = 'md',
}: {
    label: string
    value: T
    options: readonly (T | SelectOption<T>)[]
    onChange: (value: T) => void
    className?: string
    disabled?: boolean
    /** 'sm' is the small button of a list footer ("Show 10") */
    size?: 'sm' | 'md'
}) {
    const items: SelectOption<T>[] = options.map((option) =>
        typeof option === 'string' ? { value: option, label: option } : option
    )
    const selected = items.find((item) => item.value === value)
    const [isOpen, setIsOpen] = React.useState(false)
    const [position, setPosition] = React.useState<React.CSSProperties>({})
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const listId = React.useId()

    const close = React.useCallback((focusTrigger = true) => {
        setIsOpen(false)
        if (focusTrigger) triggerRef.current?.focus()
    }, [])

    // place the menu under the button, or above it when the space below is short
    const place = React.useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect()
        if (!rect) return
        const menuHeight = Math.min(280, items.length * 32 + 8)
        const below = window.innerHeight - rect.bottom
        const openUp = below < menuHeight + 12 && rect.top > below
        setPosition({
            left: rect.left,
            minWidth: rect.width,
            ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        })
    }, [items.length])

    React.useLayoutEffect(() => {
        if (isOpen) place()
    }, [isOpen, place])

    React.useEffect(() => {
        if (!isOpen) return
        const menu = menuRef.current
        const optionsOf = (): HTMLElement[] =>
            menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]')) : []
        ;(menu?.querySelector<HTMLElement>('[aria-selected="true"]') ?? optionsOf()[0])?.focus()

        const onKey = (event: KeyboardEvent) => {
            const list = optionsOf()
            const at = list.indexOf(document.activeElement as HTMLElement)
            const focus = (index: number) => {
                event.preventDefault()
                list[(index + list.length) % list.length]?.focus()
            }
            if (event.key === 'Escape') {
                // the dialog behind the menu stays open
                event.preventDefault()
                event.stopPropagation()
                close()
            } else if (event.key === 'ArrowDown') focus(at + 1)
            else if (event.key === 'ArrowUp') focus(at - 1)
            else if (event.key === 'Home') focus(0)
            else if (event.key === 'End') focus(list.length - 1)
            else if (event.key === 'Tab') close(false)
        }
        const onDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node
            if (menu?.contains(target) || triggerRef.current?.contains(target)) return
            close(false)
        }
        // the page or the dialog scrolls under the menu: close it rather than float away
        const onScroll = (event: Event) => {
            if (menu?.contains(event.target as Node)) return
            close(false)
        }
        document.addEventListener('keydown', onKey, true)
        document.addEventListener('mousedown', onDown)
        document.addEventListener('touchstart', onDown)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', place)
        return () => {
            document.removeEventListener('keydown', onKey, true)
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('touchstart', onDown)
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', place)
        }
    }, [isOpen, close, place])

    const pick = (next: T) => {
        if (next !== value) onChange(next)
        close()
    }

    return (
        <div
            className={cn('relative', size === 'sm' ? 'w-auto' : 'w-[170px] max-w-full', className)}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listId : undefined}
                disabled={disabled}
                onClick={() => (isOpen ? close() : setIsOpen(true))}
                onKeyDown={(event) => {
                    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                        event.preventDefault()
                        setIsOpen(true)
                    }
                }}
                className={cn(
                    'flex w-full items-center justify-between gap-2 bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg text-[#D6D5C9] hover:bg-[#242424] hover:border-[#383736] transition-colors outline-none focus-visible:border-[#7B7A79] cursor-pointer disabled:opacity-50 disabled:cursor-default',
                    size === 'sm'
                        ? 'px-2.5 py-1 text-[12.5px] font-medium'
                        : 'pl-3 pr-2.5 py-1.5 text-[13px]',
                    isOpen && 'border-[#383736] bg-[#242424]'
                )}
            >
                <span className={cn('truncate', !selected?.value && 'text-[#7B7A79]')}>
                    {selected?.label ?? value}
                </span>
                <ChevronDown
                    className={cn(
                        'w-3.5 h-3.5 shrink-0 text-[#7B7A79] transition-transform',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>
            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        id={listId}
                        role="listbox"
                        aria-label={label}
                        style={position}
                        className={panelClass}
                    >
                        {items.map((item) => {
                            const isSelected = item.value === value
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    tabIndex={-1}
                                    onClick={() => pick(item.value)}
                                    className={cn(optionClass, isSelected && 'text-white')}
                                >
                                    <span className="truncate">{item.label}</span>
                                    {isSelected && (
                                        <Check className="h-3.5 w-3.5 shrink-0 text-white" />
                                    )}
                                </button>
                            )
                        })}
                    </div>,
                    document.body
                )}
        </div>
    )
}

const PAGE_SIZES = ['10', '20', '30'] as const

/** "Show 10" under a list: how many rows a page has */
/**
 * The empty state inside a list box of a settings page: a small hand-drawn drawing (the
 * same drawings as the empty lists and the Usage chart), one title, then an optional button.
 * `small` is for a section that shares the page with others (Running now on Sandbox).
 */
export const SettingsEmptyArt: React.FC<{
    art: ListArtKind
    title: string
    small?: boolean
    children?: React.ReactNode
}> = ({ art, title, small, children }) => (
    <div
        className={cn(
            'flex flex-col items-center justify-center gap-3 text-center px-6',
            small ? 'py-6' : 'py-8'
        )}
    >
        <div className={cn('text-[#8A8987]', small ? 'h-[70px] w-[80px]' : 'h-[105px] w-[120px]')}>
            <ListArt kind={art} strokePx={small ? 2 : 2.2} widthPx={small ? 80 : 120} />
        </div>
        <h3 className="text-[14px] font-medium text-[#D6D5C9]">{title}</h3>
        {children && (
            <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
        )}
    </div>
)

export const PageSizeSelect: React.FC<{
    value: number
    onChange: (value: number) => void
}> = ({ value, onChange }) => (
    <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-[#7B7A79]">Show</span>
        <SettingsSelect
            label="Rows per page"
            size="sm"
            value={String(value)}
            options={PAGE_SIZES}
            onChange={(next) => onChange(Number(next))}
            className="w-[70px]"
        />
    </div>
)

export const SettingsInput: React.FC<{
    label: string
    value: string
    onChange: (value: string) => void
    mono?: boolean
    prefix?: string
    type?: 'text' | 'time'
    className?: string
    placeholder?: string
}> = ({ label, value, onChange, mono, prefix, type = 'text', className, placeholder }) => (
    <div className={cn('relative w-[170px] max-w-full', className)}>
        {prefix && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#7B7A79]">
                {prefix}
            </span>
        )}
        <input
            type={type}
            aria-label={label}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                fieldClass,
                'w-full py-1.5 pr-3',
                prefix ? 'pl-6' : 'pl-3',
                mono && 'font-mono',
                type === 'time' && '[color-scheme:dark]'
            )}
        />
    </div>
)
