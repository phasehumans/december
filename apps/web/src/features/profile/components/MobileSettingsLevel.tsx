import { ArrowUpRight, ChevronRight } from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAdminPath } from '@/features/profile/hooks/useAdminPath'
import { isTeamsEnabled } from '@/features/profile/lib/teams'
import { SheetRow, useBottomSheet } from '@/shared/components/ui/BottomSheet'
import { getWebUrl } from '@/shared/config/env'

// phones only: the Settings level of the menu sheet (A1). a row closes the sheet and opens
// that settings page. desktop keeps its settings sidebar.

const SETTINGS_ROWS: { slug: string; label: string }[] = [
    { slug: 'account', label: 'Account' },
    { slug: 'connections', label: 'Connections' },
    { slug: 'repositories', label: 'Repositories' },
    { slug: 'pull-requests', label: 'Pull requests' },
    { slug: 'sandbox', label: 'Sandbox' },
    { slug: 'secrets', label: 'Secrets' },
    { slug: 'models', label: 'API keys' },
    { slug: 'billing', label: 'Billing' },
    { slug: 'usage', label: 'Usage' },
    // off today (see lib/teams.ts)
    ...(isTeamsEnabled() ? [{ slug: 'members', label: 'Members' }] : []),
]

// the same outside links as the desktop settings sidebar, in the same order
const EXTERNAL_ROWS = [
    { label: 'Changelog', path: '/docs/changelog' },
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms of Service', path: '/terms' },
]

const trailingIconClass = 'w-4 h-4 text-[#7B7A79] shrink-0'

interface MobileSettingsLevelProps {
    isAuthenticated: boolean
    onOpenAuth: () => void
    onSendFeedback: () => void
}

export const MobileSettingsLevel: React.FC<MobileSettingsLevelProps> = ({
    isAuthenticated,
    onOpenAuth,
    onSendFeedback,
}) => {
    const { closeThen } = useBottomSheet()
    const navigate = useNavigate()
    const adminPath = useAdminPath(isAuthenticated)
    const path = useLocation().pathname

    const openPage = (slug: string) =>
        closeThen(isAuthenticated ? () => navigate(`/settings/${slug}`) : onOpenAuth)

    return (
        <div className="flex flex-col pb-1">
            {SETTINGS_ROWS.map((row) => (
                <SheetRow
                    key={row.slug}
                    label={row.label}
                    active={path.startsWith(`/settings/${row.slug}`)}
                    trailing={<ChevronRight className={trailingIconClass} strokeWidth={1.75} />}
                    onClick={() => openPage(row.slug)}
                />
            ))}

            {/* no group label: a small gap sets the outside links apart */}
            <div className="h-3" />
            {EXTERNAL_ROWS.map((row) => (
                <SheetRow
                    key={row.path}
                    label={row.label}
                    trailing={<ArrowUpRight className={trailingIconClass} strokeWidth={1.75} />}
                    onClick={() =>
                        window.open(`${getWebUrl()}${row.path}`, '_blank', 'noopener,noreferrer')
                    }
                />
            ))}
            <SheetRow
                label="Send feedback"
                onClick={() => closeThen(isAuthenticated ? onSendFeedback : onOpenAuth)}
            />
            {adminPath && (
                <SheetRow
                    label="Admin panel"
                    trailing={<ChevronRight className={trailingIconClass} strokeWidth={1.75} />}
                    // U2: the panel is its own tool, so it opens in a new tab
                    onClick={() =>
                        closeThen(() => window.open(adminPath, '_blank', 'noopener,noreferrer'))
                    }
                />
            )}
        </div>
    )
}
