import React from 'react'

import { usePreferences, type SendKey } from '@/features/profile/lib/preferences'

/** the keyboard shortcuts of the app. the two send rows follow the "Send with" preference */
export const getShortcuts = (sendKey: SendKey): [string, string][] => [
    ['Commands', '/'],
    ['Mention a repo, session or secret', '@'],
    ['Send', sendKey === 'mod-enter' ? 'Ctrl Enter' : 'Enter'],
    ['New line', sendKey === 'mod-enter' ? 'Enter' : 'Shift Enter'],
    ['Search', 'Ctrl K'],
    ['Open or close the sidebar', 'Ctrl .'],
]

/** the shortcut list, used by /keybindings and by Settings, Preferences (N12-A) */
export const ShortcutRows: React.FC = () => {
    const sendKey = usePreferences((s) => s.sendKey)
    return (
        <>
            {getShortcuts(sendKey).map(([label, keys]) => (
                <div
                    key={label}
                    className="flex items-center justify-between gap-3 py-1.5 text-[13px] text-[#D6D5D4]"
                >
                    <span>{label}</span>
                    <kbd className="font-mono text-[11.5px] font-medium text-[#D6D5D4] bg-[#232323] border border-[#2E2E2E] rounded-md px-1.5 py-px whitespace-nowrap">
                        {keys}
                    </kbd>
                </div>
            ))}
        </>
    )
}
