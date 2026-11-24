import { ArrowUpRight, ChevronRight } from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { SoonPill } from '@/features/connections/components/ConnectionsUi'
import { usePreviewOn } from '@/features/profile/components/SettingsUi'
import { SheetRow, useBottomSheet } from '@/shared/components/ui/BottomSheet'
import { getWebUrl } from '@/shared/config/env'

// phones only: the Settings level of the menu sheet (A1). a row closes the sheet and opens
// that settings page. desktop keeps its settings sidebar.

const SETTINGS_ROWS: { slug: string; label: string; soon?: boolean }[] = [
    { slug: 'account', label: 'Account' },
    { slug: 'notifications', label: 'Notifications', soon: true },
    { slug: 'defaults', label: 'Defaults', soon: true },
    { slug: 'repositories', label: 'Repositories' },
    { slug: 'pull-requests', label: 'Pull requests', soon: true },
    { slug: 'sandbox', label: 'Sandbox', soon: true },
    { slug: 'connections', label: 'Connections' },
    { slug: 'secrets', label: 'Secrets' },
    { slug: 'models', label: 'API keys' },
    { slug: 'billing', label: 'Billing' },
    { slug: 'usage', label: 'Usage' },
    { slug: 'members', label: 'Members', soon: true },
]

const EXTERNAL_ROWS = [
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
    const path = useLocation().pathname
    const isPreview = usePreviewOn()

    const openPage = (slug: string) =>
        closeThen(isAuthenticated ? () => navigate(`/settings/${slug}`) : onOpenAuth)

    return (
        <div className="flex flex-col pb-1">
            {SETTINGS_ROWS.map((row) => (
                <SheetRow
                    key={row.slug}
                    label={row.label}
                    active={path.startsWith(`/settings/${row.slug}`)}
                    trailing={
                        row.soon && !isPreview ? (
                            <SoonPill />
                        ) : (
                            <ChevronRight className={trailingIconClass} strokeWidth={1.75} />
                        )
                    }
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
        </div>
    )
}
