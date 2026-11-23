import { ArrowUpRight, ChevronRight } from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { SheetRow, useBottomSheet } from '@/shared/components/ui/BottomSheet'
import { getWebUrl } from '@/shared/config/env'

// phones only: the Settings level of the menu sheet (A1). a row closes the sheet and opens
// that settings page. desktop keeps its settings sidebar.

const SETTINGS_ROWS = [
    { slug: 'account', label: 'Account' },
    { slug: 'connections', label: 'Connections' },
    { slug: 'secrets', label: 'Secrets' },
    { slug: 'models', label: 'Model keys' },
    { slug: 'billing', label: 'Billing' },
    { slug: 'usage', label: 'Usage' },
]

const EXTERNAL_ROWS = [
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms of Service', path: '/terms' },
]

const trailingIconClass = 'w-4 h-4 text-[#7B7A79] shrink-0'

interface MobileSettingsLevelProps {
    isAuthenticated: boolean
    onOpenAuth: () => void
}

export const MobileSettingsLevel: React.FC<MobileSettingsLevelProps> = ({
    isAuthenticated,
    onOpenAuth,
}) => {
    const { closeThen } = useBottomSheet()
    const navigate = useNavigate()
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
        </div>
    )
}
