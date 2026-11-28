import { Check, ChevronLeft, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import React from 'react'

import { BrandIcon } from './BrandIcons'

import type { BrandKey } from '../types'

import {
    listBoxClass,
    listHeaderClass,
    listRowsClass,
} from '@/features/profile/components/settingsStyles'
import { Modal, ModalSheetContext } from '@/shared/components/ui/Modal'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { cn } from '@/shared/lib/utils'

// shared parts for the Connections page. every style here is copied from an existing
// screen (Secrets list and modal, Sessions filters, Notifications switch, delete account).

export const fieldLabelClass = 'text-[12px] font-medium text-[#8F8E8D]'
export const inputClass =
    'w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]'
export const textareaClass = cn(inputClass, 'font-mono resize-none leading-relaxed')
const ghostButtonClass =
    'bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50 cursor-pointer'
const whiteButtonClass =
    'bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer whitespace-nowrap'

export const ListBox: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => <div className={cn(listBoxClass, className)}>{children}</div>

export const ListHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={cn('hidden md:flex items-center gap-3', listHeaderClass)}>{children}</div>
)

export const ListRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={listRowsClass}>{children}</div>
)

export const ListRow: React.FC<{
    children: React.ReactNode
    onClick?: () => void
    dim?: boolean
    className?: string
}> = ({ children, onClick, dim, className }) => (
    <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
            if (onClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onClick()
            }
        }}
        className={cn(
            'group flex items-center gap-3 px-3.5 md:px-4 py-3 text-[13px] min-w-0 transition-colors outline-none',
            onClick && 'cursor-pointer hover:bg-[#242424] focus-visible:bg-[#242424]',
            dim && 'opacity-50',
            className
        )}
    >
        {children}
    </div>
)

export const EmptyRow: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({
    children,
    action,
}) => (
    <div className="flex flex-col items-center justify-center gap-3 text-center min-h-[220px] p-6">
        <h3 className="text-[14px] font-medium text-[#D6D5C9]">{children}</h3>
        {action}
    </div>
)

/** rows that stand in for a list while it loads, like the Apps tab */
export const ListSkeleton: React.FC = () => (
    <ListRows>
        {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 md:px-4 py-3">
                <Skeleton className="h-3 w-32 rounded bg-white/[0.04]" />
            </div>
        ))}
    </ListRows>
)

/** facts box on a detail page: label on the left, value on the right */
export const FactsBox: React.FC<{ rows: { label: string; value: React.ReactNode }[] }> = ({
    rows,
}) => (
    <ListBox>
        <ListRows>
            {rows.map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-3.5 md:px-4 py-3">
                    <span className="w-[120px] shrink-0 text-[12.5px] text-[#7B7A79]">
                        {row.label}
                    </span>
                    <span className="min-w-0 truncate text-[13px] text-[#D6D5C9]">{row.value}</span>
                </div>
            ))}
        </ListRows>
    </ListBox>
)

export const Switch: React.FC<{
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
    disabled?: boolean
    disabledReason?: string
}> = ({ checked, onChange, label, disabled, disabledReason }) => {
    const button = (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation()
                onChange(!checked)
            }}
            className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                checked ? 'bg-[#87B2F4]' : 'bg-[#100E12] border-[#383736]'
            )}
        >
            <span
                className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out',
                    checked ? 'translate-x-4 bg-[#100E12]' : 'translate-x-0 bg-[#383736]'
                )}
            />
        </button>
    )
    if (disabled && disabledReason) {
        return (
            <Tooltip position="top" align="end" content={disabledReason}>
                {button}
            </Tooltip>
        )
    }
    return button
}

export type PillTone = 'ok' | 'warn' | 'err' | 'muted'

export const Pill: React.FC<{ tone?: PillTone; children: React.ReactNode }> = ({
    tone = 'muted',
    children,
}) => (
    <span
        className={cn(
            'inline-flex items-center rounded-full px-2 py-px text-[10.5px] font-medium whitespace-nowrap shrink-0',
            tone === 'ok' && 'bg-emerald-500/20 text-emerald-300',
            tone === 'warn' && 'bg-amber-400/15 text-amber-400',
            tone === 'err' && 'bg-red-500/10 text-red-400',
            tone === 'muted' && 'border border-[#383735] text-[#919191]'
        )}
    >
        {children}
    </span>
)

export const SoonPill: React.FC = () => (
    <span className="text-[10px] font-medium text-[#919191] border border-[#383735] rounded-full px-1.5 leading-4 shrink-0">
        Soon
    </span>
)

/** marks a part that runs on sample values: there is no server behind it yet */
export const DemoPill: React.FC = () => (
    <span className="text-[10px] font-medium text-[#919191] border border-[#383735] rounded-full px-1.5 leading-4 shrink-0">
        Demo
    </span>
)

export const LogoTile: React.FC<{ brand?: BrandKey; name: string; large?: boolean }> = ({
    brand,
    name,
    large,
}) => (
    <div
        className={cn(
            'bg-[#191919] border border-[#383736] flex items-center justify-center shrink-0',
            large ? 'w-9 h-9 rounded-[10px]' : 'w-7 h-7 rounded-lg'
        )}
    >
        {brand ? (
            <BrandIcon
                brand={brand}
                className={large ? 'w-[18px] h-[18px]' : 'w-[15px] h-[15px]'}
            />
        ) : (
            <span className="text-[12px] font-semibold text-[#8F8E8D] uppercase">
                {name.charAt(0)}
            </span>
        )}
    </div>
)

export const SearchInput: React.FC<{
    value: string
    onChange: (value: string) => void
    placeholder: string
}> = ({ value, onChange, placeholder }) => (
    <div className="relative flex-1 max-w-full md:max-w-[320px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
        <input
            type="text"
            aria-label={placeholder}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none focus:border-[#5A5A5A] transition-colors"
        />
    </div>
)

export const PrimaryButton: React.FC<{
    onClick: () => void
    children: React.ReactNode
    trailing?: React.ReactNode
}> = ({ onClick, children, trailing }) => (
    <button
        type="button"
        onClick={onClick}
        className="hidden md:flex px-4 py-1.5 rounded-lg bg-[#87B2F4] text-[#100E12] hover:bg-[#A3C7FF] text-[13px] font-medium transition-colors items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
    >
        <Plus className="w-3.5 h-3.5" />
        <span>{children}</span>
        {trailing}
    </button>
)

export const SecondaryButton: React.FC<{
    onClick?: () => void
    children: React.ReactNode
    disabled?: boolean
    small?: boolean
    className?: string
}> = ({ onClick, children, disabled, small, className }) => (
    <button
        type="button"
        onClick={(e) => {
            e.stopPropagation()
            onClick?.()
        }}
        disabled={disabled}
        className={cn(
            'rounded-lg border border-[#282828] bg-[#202020] hover:bg-[#282828] font-medium text-[#D6D5C9] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-default disabled:hover:bg-[#202020]',
            small ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[12.5px]',
            className
        )}
    >
        {children}
    </button>
)

export const Spinner: React.FC<{ dark?: boolean }> = ({ dark }) => (
    <span
        className={cn(
            'w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin',
            dark ? 'border-black' : 'border-[#D6D5C9]'
        )}
    />
)

/** short green confirmation next to a control, like "Copied" on Secrets */
export const DoneHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="flex items-center gap-1 text-[12.5px] font-medium text-[#34D399] whitespace-nowrap">
        <Check className="w-3.5 h-3.5" />
        {children}
    </span>
)

/** shows a hint for 2 seconds after `trigger` changes to a new non-zero value */
export const useFlash = (): [boolean, () => void] => {
    const [visible, setVisible] = React.useState(false)
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current)
        },
        []
    )
    const flash = React.useCallback(() => {
        if (timer.current) clearTimeout(timer.current)
        setVisible(true)
        timer.current = setTimeout(() => setVisible(false), 2000)
    }, [])
    return [visible, flash]
}

/** edit and delete icons that show on row hover (desktop), like Secrets */
export const RowActions: React.FC<{ onEdit?: () => void; onDelete?: () => void; noun: string }> = ({
    onEdit,
    onDelete,
    noun,
}) => (
    <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 shrink-0">
        {onEdit && (
            <Tooltip position="top" content={`Edit ${noun}`}>
                <button
                    type="button"
                    aria-label={`Edit ${noun}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onEdit()
                    }}
                    className="p-1 rounded text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
            </Tooltip>
        )}
        {onDelete && (
            <Tooltip position="top" align="end" content={`Delete ${noun}`}>
                <button
                    type="button"
                    aria-label={`Delete ${noun}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                    className="p-1 rounded text-[#7B7A79] hover:text-red-400 hover:bg-[#242323] transition-colors cursor-pointer"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </Tooltip>
        )}
    </div>
)

export interface MenuItem {
    label: string
    onClick: () => void
    danger?: boolean
    hidden?: boolean
}

/** ⋯ button with a small menu, like the Secrets row menu on phones */
export const MoreMenu: React.FC<{ items: MenuItem[]; label: string; mobileOnly?: boolean }> = ({
    items,
    label,
    mobileOnly,
}) => {
    const [open, setOpen] = React.useState(false)
    const visible = items.filter((item) => !item.hidden)
    if (visible.length === 0) return null
    return (
        <div className={cn('relative shrink-0', mobileOnly && 'md:hidden')}>
            <button
                type="button"
                aria-label={label}
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen((v) => !v)
                }}
                className="p-1 rounded text-[#7B7A79] hover:text-white hover:bg-[#202020] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                            e.stopPropagation()
                            setOpen(false)
                        }}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-40 bg-[#1C1C1C] border border-[#2B2A27] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                        {visible.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setOpen(false)
                                    item.onClick()
                                }}
                                className={cn(
                                    'flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[12px] transition-colors text-left cursor-pointer',
                                    item.danger
                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                        : 'text-[#D6D5C9] hover:text-white hover:bg-[#282828]'
                                )}
                            >
                                {item.danger && <Trash2 className="w-3.5 h-3.5" />}
                                {item.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

/** choice buttons, same as the All / Running filter on Sessions */
export function ChoiceGroup<T extends string>({
    options,
    value,
    onChange,
    label,
    disabled,
}: {
    options: { value: T; label: React.ReactNode }[]
    value: T
    onChange: (value: T) => void
    label: string
    disabled?: boolean
}) {
    const boxRef = React.useRef<HTMLDivElement>(null)
    // a narrow screen cuts the last choices off: keep the chosen one in view (a link to
    // /connections/memory on a phone opens with Memory past the edge)
    React.useEffect(() => {
        const box = boxRef.current
        const chosen = box?.querySelector<HTMLElement>('[aria-checked="true"]')
        if (!box || !chosen) return
        const boxRect = box.getBoundingClientRect()
        const chosenRect = chosen.getBoundingClientRect()
        if (chosenRect.right > boxRect.right) box.scrollLeft += chosenRect.right - boxRect.right
        else if (chosenRect.left < boxRect.left) box.scrollLeft -= boxRect.left - chosenRect.left
    }, [value])
    return (
        <div
            ref={boxRef}
            role="radiogroup"
            aria-label={label}
            className="inline-flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-lg border border-[#282828] self-start max-w-full overflow-x-auto no-scrollbar [scrollbar-width:none]"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={value === option.value}
                    disabled={disabled}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'px-2.5 py-1 text-[12px] font-medium rounded-md transition-all whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                        value === option.value
                            ? 'bg-[#282828] text-white shadow-sm'
                            : 'text-[#8F8E8D] hover:text-[#D6D5C9]'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

export const BackLink: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="hidden md:flex items-center self-start text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#191919] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
    >
        <ChevronLeft className="w-4 h-4 mr-1.5" />
        {label}
    </button>
)

export const DetailHeader: React.FC<{
    title: React.ReactNode
    logo?: React.ReactNode
    children?: React.ReactNode
    mono?: boolean
}> = ({ title, logo, children, mono }) => (
    <div className="flex flex-wrap items-center gap-3 mt-1 md:mt-4 mb-5">
        {logo}
        <h1
            className={cn(
                'text-[20px] md:text-[24px] font-medium tracking-[-0.025em] text-[#D6D5C9] truncate min-w-0',
                mono && 'font-mono text-[18px] md:text-[20px] tracking-normal'
            )}
        >
            {title}
        </h1>
        {children}
    </div>
)

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="text-[13px] font-medium text-[#D6D5C9]">{children}</span>
)

export const FormError: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
    children ? (
        <p role="alert" className="text-[12.5px] text-red-500 font-medium">
            {children}
        </p>
    ) : null

export const ModalActions: React.FC<{
    onCancel: () => void
    submitLabel: React.ReactNode
    submitDisabled?: boolean
    leading?: React.ReactNode
    danger?: boolean
    isPending?: boolean
}> = ({ onCancel, submitLabel, submitDisabled, leading, danger, isPending }) => {
    const inSheet = React.useContext(ModalSheetContext)
    const submitClass = danger
        ? 'bg-[#EF4444] text-white hover:bg-red-600 active:scale-[0.97] transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center'
        : cn(whiteButtonClass, 'min-w-[100px]')

    // phones: the dialog is a bottom sheet. one full-width button, back and drag close it
    if (inSheet) {
        return (
            <div className="mt-1 flex flex-col gap-2.5">
                <button
                    type="submit"
                    disabled={submitDisabled || isPending}
                    className={cn(submitClass, 'w-full py-2.5')}
                >
                    {isPending ? <Spinner dark={!danger} /> : submitLabel}
                </button>
                {leading && <div className="flex justify-center">{leading}</div>}
            </div>
        )
    }

    return (
        <div className="mt-1 flex items-center justify-end gap-2.5 flex-wrap">
            {leading}
            {leading && <span className="flex-1" />}
            <button type="button" onClick={onCancel} className={ghostButtonClass}>
                Cancel
            </button>
            <button type="submit" disabled={submitDisabled || isPending} className={submitClass}>
                {isPending ? <Spinner dark={!danger} /> : submitLabel}
            </button>
        </div>
    )
}

export const WhiteButton: React.FC<{
    onClick?: () => void
    children: React.ReactNode
    disabled?: boolean
    type?: 'button' | 'submit'
}> = ({ onClick, children, disabled, type }) => (
    <button
        type={type === 'submit' ? 'submit' : 'button'}
        onClick={onClick}
        disabled={disabled}
        className={whiteButtonClass}
    >
        {children}
    </button>
)

export const GhostButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
    onClick,
    children,
}) => (
    <button type="button" onClick={onClick} className={ghostButtonClass}>
        {children}
    </button>
)

/** small confirm, same look as the delete account modal */
export const ConfirmModal: React.FC<{
    isOpen: boolean
    title: string
    body?: React.ReactNode
    confirmLabel: string
    onConfirm: () => void
    onClose: () => void
}> = ({ isOpen, title, body, confirmLabel, onConfirm, onClose }) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        variant="premium"
        showLogo={false}
        sheetOnPhone
    >
        <form
            onSubmit={(e) => {
                // the modal is portaled, so stop the submit reaching a form behind it
                e.preventDefault()
                e.stopPropagation()
                onConfirm()
            }}
            className="flex flex-col gap-4"
        >
            {body && <p className="text-[13px] text-[#8F8E8D] leading-relaxed">{body}</p>}
            <ModalActions onCancel={onClose} submitLabel={confirmLabel} danger />
        </form>
    </Modal>
)

/** filters a list by name, case-insensitive */
export const matchesQuery = (query: string, ...fields: (string | undefined)[]) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return fields.some((f) => f?.toLowerCase().includes(q))
}

export const formatShortDate = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
