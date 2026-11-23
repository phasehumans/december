import { ArrowUpRight, Check, ChevronRight, Copy } from 'lucide-react'
import React from 'react'

import { BottomSheet, SheetHeader } from '@/shared/components/ui/BottomSheet'
import { getWebUrl } from '@/shared/config/env'
import { cn } from '@/shared/lib/utils'

// phones only: the settings list page at /settings (F1). desktop keeps its sidebar.

const SETTINGS_ROWS = [
    { slug: 'account', label: 'Account' },
    { slug: 'connections', label: 'Connections' },
    { slug: 'secrets', label: 'Secrets' },
    { slug: 'models', label: 'Model keys' },
    { slug: 'billing', label: 'Billing' },
    { slug: 'usage', label: 'Usage' },
]

const EXTERNAL_ROWS = [
    { label: 'Changelog', path: '/docs/changelog' },
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms of Service', path: '/terms' },
]

const CLI_INSTALL_COMMAND = 'npm install -g @trydecember/cli'
const SIGN_OUT_CONFIRM_MS = 4000

const rowClass =
    'w-full flex items-center justify-between gap-3 h-10 px-2.5 rounded-[10px] text-left text-[14px] font-medium text-[#D6D5D4] active:bg-[#1F1F1F] transition-colors outline-none cursor-pointer'

const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="px-2.5 pt-3 pb-1 text-[11.5px] font-medium text-[#7B7A79]">{children}</div>
)

const CliSheet: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [isCopied, setIsCopied] = React.useState(false)

    React.useEffect(() => {
        if (!isCopied) return
        const timer = setTimeout(() => setIsCopied(false), 2000)
        return () => clearTimeout(timer)
    }, [isCopied])

    const handleCopy = () => {
        navigator.clipboard
            .writeText(CLI_INSTALL_COMMAND)
            .then(() => setIsCopied(true))
            .catch(() => {
                // clipboard can be blocked by the browser: keep the command visible to copy by hand
                setIsCopied(false)
            })
    }

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            ariaLabel="December CLI"
            header={<SheetHeader title="December CLI" />}
        >
            <div className="px-1 pb-2">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border border-[#2A2928] rounded-lg">
                    <div className="flex items-center min-w-0">
                        <span className="text-[#7B7A79] mr-2 text-[11.5px] font-mono select-none">
                            $
                        </span>
                        <span className="text-[#D6D5C9] text-[11.5px] font-mono truncate tracking-tight select-all">
                            {CLI_INSTALL_COMMAND}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopy}
                        aria-label="Copy command"
                        className="text-[#7B7A79] active:text-[#D6D5C9] p-1.5 rounded-md active:bg-[#2A2928] outline-none shrink-0 cursor-pointer"
                    >
                        {isCopied ? (
                            <Check className="w-4 h-4 text-[#87B2F4]" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </BottomSheet>
    )
}

interface MobileSettingsListProps {
    onOpenPage: (slug: string) => void
    onSignOut?: () => void
}

export const MobileSettingsList: React.FC<MobileSettingsListProps> = ({
    onOpenPage,
    onSignOut,
}) => {
    const [isCliOpen, setIsCliOpen] = React.useState(false)
    const [confirmSignOut, setConfirmSignOut] = React.useState(false)

    React.useEffect(() => {
        if (!confirmSignOut) return
        const timer = setTimeout(() => setConfirmSignOut(false), SIGN_OUT_CONFIRM_MS)
        return () => clearTimeout(timer)
    }, [confirmSignOut])

    const handleSignOut = () => {
        if (!confirmSignOut) {
            setConfirmSignOut(true)
            return
        }
        setConfirmSignOut(false)
        onSignOut?.()
    }

    return (
        <div className="md:hidden flex flex-col px-2.5 pb-6">
            <GroupLabel>Settings</GroupLabel>
            {SETTINGS_ROWS.map((row) => (
                <button
                    key={row.slug}
                    type="button"
                    onClick={() => onOpenPage(row.slug)}
                    className={rowClass}
                >
                    <span className="truncate">{row.label}</span>
                    <ChevronRight className="w-4 h-4 text-[#7B7A79] shrink-0" strokeWidth={1.75} />
                </button>
            ))}

            <GroupLabel>About</GroupLabel>
            {EXTERNAL_ROWS.map((row) => (
                <button
                    key={row.path}
                    type="button"
                    onClick={() =>
                        window.open(`${getWebUrl()}${row.path}`, '_blank', 'noopener,noreferrer')
                    }
                    className={rowClass}
                >
                    <span className="truncate">{row.label}</span>
                    <ArrowUpRight className="w-4 h-4 text-[#7B7A79] shrink-0" strokeWidth={1.75} />
                </button>
            ))}
            <button type="button" onClick={() => setIsCliOpen(true)} className={rowClass}>
                <span className="truncate">Try December CLI</span>
                <ChevronRight className="w-4 h-4 text-[#7B7A79] shrink-0" strokeWidth={1.75} />
            </button>
            {onSignOut && (
                <button
                    type="button"
                    onClick={handleSignOut}
                    className={cn(
                        rowClass,
                        'text-[#E57373]',
                        confirmSignOut && 'bg-[#E57373]/[0.08]'
                    )}
                >
                    <span className="truncate">
                        {confirmSignOut ? 'Tap again to sign out' : 'Sign out'}
                    </span>
                </button>
            )}

            <CliSheet isOpen={isCliOpen} onClose={() => setIsCliOpen(false)} />
        </div>
    )
}
