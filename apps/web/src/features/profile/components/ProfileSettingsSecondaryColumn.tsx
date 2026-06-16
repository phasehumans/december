import { Loader2 } from 'lucide-react'
import React from 'react'

import { SettingsSection } from './SettingsSection'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { Icons } from '@/shared/components/ui/Icons'

interface ProfileSettingsSecondaryColumnProps {
    isGithubConnected: boolean
    onConnectGithub: () => void
    onSignOut: () => void
}

export const ProfileSettingsSecondaryColumn: React.FC<ProfileSettingsSecondaryColumnProps> = ({
    isGithubConnected,
    onConnectGithub,
    onSignOut,
}) => {
    const { data: overview, isLoading: isBillingLoading } = useBillingOverview()

    const renderUsageContent = () => {
        if (isBillingLoading) {
            return (
                <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                    <span className="text-xs text-neutral-500">Loading usage...</span>
                </div>
            )
        }

        if (!overview) {
            return <div className="text-xs text-neutral-500 py-2">Usage details unavailable</div>
        }

        const unlimited = overview.credits.unlimited
        const usedInCents = overview.credits.usedInCents
        const limitInCents = overview.credits.limitInCents ?? 0

        const usedStr = `$${(usedInCents / 100).toFixed(2)}`
        const limitStr = unlimited ? 'Unlimited' : `$${(limitInCents / 100).toFixed(2)}`
        const progressPercent = unlimited ? 0 : Math.min((usedInCents / limitInCents) * 100, 100)

        return (
            <div className="rounded-xl border border-white/5 bg-surface/20 p-3">
                <div className="mb-2 flex justify-between text-xs">
                    <span className="text-neutral-400">Credits Used</span>
                    <span className="text-textMain">
                        {usedStr} / {limitStr}
                    </span>
                </div>
                {!unlimited && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                            className="h-full rounded-full bg-white transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}
                {unlimited && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <SettingsSection title="Integrations">
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-surface/20 p-3 transition-colors hover:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white">
                            <Icons.Github className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-textMain">GitHub</div>
                            <div className="text-[11px] text-neutral-500">
                                {isGithubConnected ? 'Connected' : 'Connect your repositories'}
                            </div>
                        </div>
                    </div>
                    <Badge
                        variant={isGithubConnected ? 'success' : 'default'}
                        onClick={!isGithubConnected ? onConnectGithub : undefined}
                        className="cursor-pointer"
                    >
                        {isGithubConnected ? 'Connected' : 'Connect'}
                    </Badge>
                </div>
            </SettingsSection>

            <SettingsSection title="Billing & Usage">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-neutral-400">Usage</label>
                    {renderUsageContent()}
                </div>
            </SettingsSection>

            <div className="pt-2">
                <Button
                    variant="danger"
                    onClick={onSignOut}
                    className="-ml-2 justify-start border-0 bg-transparent px-2 text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                >
                    <Icons.LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
            </div>
        </div>
    )
}
