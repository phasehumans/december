import React from 'react'

import { SettingsSection } from './SettingsSection'

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
                    <div className="rounded-xl border border-white/5 bg-surface/20 p-3">
                        <div className="mb-2 flex justify-between text-xs">
                            <span className="text-neutral-400">Generations</span>
                            <span className="text-textMain">124 / 500</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                            <div className="h-full w-[25%] rounded-full bg-white" />
                        </div>
                    </div>
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
