import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { useModelSelection } from '@/features/home/model-selection'
import { useByokList } from '@/features/profile/hooks/useByokData'
import { useGithubConnection } from '@/features/profile/hooks/useGithubConnection'

interface HomeAction {
    label: string
    href?: string
    onClick?: () => void
}

interface HomeStatus {
    text: string
    actions: HomeAction[]
}

/**
 * One line under the Home prompt box, as wide as the box and tucked behind its bottom
 * edge. It shows the one thing that needs action, and nothing when nothing does.
 * Order: GitHub not connected, then no credits.
 */
export const HomeStatusStrip: React.FC = () => {
    const navigate = useNavigate()
    const github = useGithubConnection(true)
    const { data: overview } = useBillingOverview(true)
    const billingSource = useModelSelection((s) => s.source)
    const lastOwnKey = useModelSelection((s) => s.lastOwnKey)
    const selectModel = useModelSelection((s) => s.select)
    const { data: byokData } = useByokList(true)

    // with a saved key the user can go on without credits
    const switchToOwnKey = () => {
        const credentials = byokData?.credentials || []
        const remembered =
            lastOwnKey &&
            credentials.some(
                (c) => c.provider === lastOwnKey.provider && c.models.includes(lastOwnKey.model)
            )
        const first = credentials[0]
        if (remembered && lastOwnKey) selectModel({ ...lastOwnKey, source: 'OWN_KEY' })
        else if (first)
            selectModel({ model: first.defaultModel, provider: first.provider, source: 'OWN_KEY' })
    }

    let status: HomeStatus | null = null
    if (github.isReady && !github.isConnected) {
        status = {
            text: 'GitHub is not connected',
            actions: [{ label: 'Connect', href: github.connectUrl }],
        }
    } else if (
        // a run on the user's own key does not need December credits
        billingSource !== 'OWN_KEY' &&
        overview !== undefined &&
        (overview.creditBalance ?? 0) <= 0
    ) {
        status = {
            text: 'Credits: $ 0.00',
            actions: [
                ...((byokData?.credentials.length ?? 0) > 0
                    ? [{ label: 'Use your key', onClick: switchToOwnKey }]
                    : []),
                { label: 'Add credits', onClick: () => navigate('/settings/billing') },
            ],
        }
    }

    if (!status) return null

    const actionClass =
        'shrink-0 text-[#D6D5D4] hover:text-white transition-colors outline-none cursor-pointer'

    return (
        <div
            data-testid="home-status-strip"
            className="-mt-[18px] flex items-center justify-between gap-3 rounded-b-[17px] border border-[#262626] bg-[#171717] px-5 pt-[23px] pb-[5px] text-[12px] leading-4 font-medium text-[#7B7A79]"
        >
            <span className="truncate">{status.text}</span>
            <span className="flex shrink-0 items-center gap-4">
                {status.actions.map((action) =>
                    action.href ? (
                        <a key={action.label} href={action.href} className={actionClass}>
                            {action.label}
                        </a>
                    ) : (
                        <button
                            key={action.label}
                            type="button"
                            onClick={action.onClick}
                            className={actionClass}
                        >
                            {action.label}
                        </button>
                    )
                )}
            </span>
        </div>
    )
}
