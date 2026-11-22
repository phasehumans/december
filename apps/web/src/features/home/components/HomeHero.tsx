import { Laptop } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { HomeHeader } from './HomeHeader'
import PromptInput from './PromptInput'

import type { HomeHeroProps } from '@/features/home/types'

import { useAppStore } from '@/app/store'
import { OutOfCreditsModal } from '@/features/billing/components/OutOfCreditsModal'
import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { Icons } from '@/shared/components/ui/Icons'

export const HomeHero: React.FC<HomeHeroProps> = ({
    onPromptSubmit,
    onOpenAuth,
    onOpenProject: _onOpenProject,
    onResetImportState: _onResetImportState,
}) => {
    const {
        isGenerating,
        isAuthenticated,
        activeProjectId: projectId,
        importState,
        showOutOfCreditsModal,
        setShowOutOfCreditsModal,
    } = useAppStore()
    const { data: overview } = useBillingOverview(Boolean(isAuthenticated))
    const [prompt, setPrompt] = React.useState('')
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)

    useEffect(() => {
        const handleNewSession = () => {
            setPrompt('')
            const textarea = document.getElementById(
                'home-prompt-textarea'
            ) as HTMLTextAreaElement | null
            if (textarea) {
                textarea.value = ''
            }
            textarea?.focus()
        }
        window.addEventListener('december:new-session', handleNewSession)
        return () => window.removeEventListener('december:new-session', handleNewSession)
    }, [])

    return (
        <main
            id="main-scroll-container"
            className="h-full min-h-0 overflow-hidden md:overflow-y-auto no-scrollbar scroll-smooth relative flex flex-col"
        >
            <HomeHeader isAuthenticated={isAuthenticated} onOpenAuth={onOpenAuth} />

            <div className="flex flex-col items-center justify-start pt-[19vh] md:pt-[26vh] h-full flex-1 gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto px-4 w-full shrink-0 relative">
                {/* hidden original logo to preserve exact vertical layout flow */}
                <div
                    className="flex flex-col items-center gap-3 text-center relative -left-[8px] opacity-0 pointer-events-none select-none"
                    aria-hidden="true"
                >
                    <div className="flex items-center gap-2.5">
                        <Icons.DecemberLogo
                            className="w-7 h-7 md:w-9 md:h-9 text-white"
                            strokeWidth={1}
                        />
                        <h1 className="text-[24px] md:text-[32px] font-sans font-medium tracking-[-0.025em] text-[#D6D5D4]">
                            December
                        </h1>
                    </div>
                </div>
                <div className="w-full max-w-[638px] px-2 md:px-0 relative -top-[1px] -left-[4px]">
                    <div className="absolute bottom-[calc(100%+10px)] left-2 md:left-0 right-2 md:right-0 z-10 flex justify-between items-end">
                        <div className="flex items-center gap-2 select-none mb-1 ml-1.5 md:ml-2 group cursor-default">
                            <Icons.DecemberLogo
                                className="w-[22px] h-[22px] md:w-[26px] md:h-[26px] text-white"
                                strokeWidth={1}
                            />
                            <h2 className="text-[20px] md:text-[23px] font-sans font-normal tracking-[-0.025em] text-white flex items-center gap-1.5 leading-none">
                                December <span className="text-[#87B2F4]">Agent</span>
                            </h2>
                        </div>
                    </div>
                    <PromptInput
                        value={prompt}
                        onChange={setPrompt}
                        onSubmit={(submittedPrompt, options) => {
                            // own-key runs are paid by the user's provider, so an empty wallet is fine
                            if (
                                isAuthenticated &&
                                options?.billingSource !== 'OWN_KEY' &&
                                overview !== undefined &&
                                (overview.creditBalance ?? 0) <= 0
                            ) {
                                setShowOutOfCreditsModal(true)
                                return
                            }
                            onPromptSubmit(submittedPrompt, options)
                        }}
                        isLoading={isGenerating}
                        onUpload={() => {}}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                        mode="agent"
                    />
                </div>
            </div>

            {/* Minimal Mobile Notice: Best experience on desktop (Option B) */}
            <div className="md:hidden fixed bottom-4 left-0 right-0 z-10 flex items-center justify-center gap-1.5 text-[11px] font-sans font-medium text-[#666666] pointer-events-none select-none tracking-tight">
                <Laptop className="w-3 h-3 text-[#666666]" />
                <span>Best experience on desktop</span>
            </div>

            <OutOfCreditsModal
                isOpen={showOutOfCreditsModal || showUpgradeModal}
                onClose={() => {
                    setShowOutOfCreditsModal(false)
                    setShowUpgradeModal(false)
                }}
            />
        </main>
    )
}
