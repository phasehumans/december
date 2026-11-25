import { ChevronDown } from 'lucide-react'
import React from 'react'
import { create } from 'zustand'

import { SettingsPageHeader, SettingsSectionHeading } from './SettingsPageHeader'
import { sectionBoxClass } from './settingsStyles'

export { blueButtonClass, outlineButtonClass } from './settingsStyles'

import { EmptyRow, ListBox } from '@/features/connections/components/ConnectionsUi'
import { isConnectionsDemoActive } from '@/features/connections/lib/connectionsDemo'
import { cn } from '@/shared/lib/utils'

// shared parts for the settings pages. the pages are connected to the server. a few parts
// are not yet (a model for each step, machine size, auto top-up, single sign-on): they run
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

export function SettingsSelect<T extends string>({
    label,
    value,
    options,
    onChange,
    className,
}: {
    label: string
    value: T
    options: readonly (T | { value: T; label: string })[]
    onChange: (value: T) => void
    className?: string
}) {
    return (
        <div className={cn('relative w-[170px] max-w-full', className)}>
            <select
                aria-label={label}
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className={cn(fieldClass, 'w-full appearance-none pl-3 pr-8 py-1.5 cursor-pointer')}
            >
                {options.map((option) => {
                    const item =
                        typeof option === 'string' ? { value: option, label: option } : option
                    return (
                        <option key={item.value} value={item.value} className="bg-[#1E1E1E]">
                            {item.label}
                        </option>
                    )
                })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7B7A79]" />
        </div>
    )
}

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

/** what normal users see on a settings page that has no server part yet */
export const SettingsSoon: React.FC<{ title: string; subtitle: React.ReactNode; text: string }> = ({
    title,
    subtitle,
    text,
}) => (
    <SettingsPage title={title} subtitle={subtitle}>
        <ListBox>
            <EmptyRow>{text}</EmptyRow>
        </ListBox>
    </SettingsPage>
)
