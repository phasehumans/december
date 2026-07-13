import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { HomeHeader } from './HomeHeader'
import { OnboardingModal } from './OnboardingModal'
import PromptInput from './PromptInput'

import type { HomeHeroProps } from '@/features/home/types'

import { useAppStore } from '@/app/store'
import { ProUpgradeModal } from '@/features/billing/components/ProUpgradeModal'
import { type CanvasRef } from '@/features/canvas/components/Canvas'
import { profileAPI } from '@/features/profile/api/profile'
import { Icons } from '@/shared/components/ui/Icons'

export const HomeHero: React.FC<HomeHeroProps> = ({
    onPromptSubmit,
    onOpenAuth,
    onImportGithub,
    onImportZip,
    onResetImportState,
}) => {
    const {
        isGenerating,
        isAuthenticated,
        canvasState,
        setCanvasState: onCanvasStateChange,
        activeProjectId: projectId,
        importState,
    } = useAppStore()
    const navigate = useNavigate()
    const canvasRef = useRef<CanvasRef>(null)
    const [prompt, setPrompt] = React.useState('')
    const [activeImportForm, setActiveImportForm] = useState<'github' | null>(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [isUbuntuMenuOpen, setIsUbuntuMenuOpen] = useState(false)
    const [chatMode, setChatMode] = useState<'agent' | 'plan'>('agent')

    const queryClient = useQueryClient()
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: isAuthenticated,
    })

    const completeOnboardingMutation = useMutation({
        mutationFn: profileAPI.completeOnboarding,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

    const [showOnboarding, setShowOnboarding] = useState(false)

    useEffect(() => {
        let timer: any = null
        if (isAuthenticated && profile && profile.hasCompletedOnboarding === false) {
            timer = setTimeout(() => {
                setShowOnboarding(true)
            }, 3000)
        } else {
            setShowOnboarding(false)
        }
        return () => {
            if (timer) clearTimeout(timer)
        }
    }, [isAuthenticated, profile])

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                const event = new CustomEvent('hero-canvas-intersect', {
                    detail: entry?.isIntersecting,
                })
                window.dispatchEvent(event)
            },
            { threshold: 0.3 }
        )
        const canvasEl = document.getElementById('hero-canvas-container')
        if (canvasEl) observer.observe(canvasEl)
        return () => observer.disconnect()
    }, [isAuthenticated])

    const toggleImportForm = (form: 'github') => {
        if (!isAuthenticated) {
            onOpenAuth()
            return
        }

        onResetImportState?.()
        setActiveImportForm((prev) => (prev === form ? null : form))
    }

    const handleTemplateClick = () => {
        if (!isAuthenticated) {
            onOpenAuth()
            return
        }
        navigate('/templates')
    }

    return (
        <main
            id="main-scroll-container"
            className="h-full min-h-0 overflow-y-auto no-scrollbar scroll-smooth relative flex flex-col"
        >
            <HomeHeader isAuthenticated={isAuthenticated} onOpenAuth={onOpenAuth} />

            <div className="flex flex-col items-center justify-start pt-[19vh] md:pt-[26vh] h-full flex-1 gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto px-4 w-full shrink-0 relative">
                {/* Hidden original logo to preserve exact vertical layout flow */}
                <div
                    className="flex flex-col items-center gap-3 text-center relative -left-[8px] opacity-0 pointer-events-none select-none"
                    aria-hidden="true"
                >
                    <div className="flex items-center gap-2.5">
                        <Icons.DecemberLogo
                            className="w-7 h-7 md:w-9 md:h-9 text-white"
                            strokeWidth={1}
                        />
                        <h1 className="text-[24px] md:text-[32px] font-sohne font-medium tracking-tight text-[#D6D5D4]">
                            December
                        </h1>
                    </div>
                </div>
                <div className="w-full max-w-[638px] px-2 md:px-0 relative -top-[1px] -left-[4px]">
                    <div className="absolute bottom-[calc(100%+10px)] left-2 md:left-0 right-2 md:right-0 z-10 flex justify-between items-end">
                        <div className="flex items-center gap-2 select-none mb-1 ml-1.5 md:ml-2 group cursor-default">
                            <Icons.DecemberLogo
                                className="w-[22px] h-[22px] md:w-[26px] md:h-[26px] text-white transition-all duration-500 ease-out group-hover:-rotate-[30deg]"
                                strokeWidth={1}
                            />
                            <h2 className="text-[20px] md:text-[23px] font-sohne font-medium tracking-tight text-white flex items-center gap-1.5 leading-none">
                                December
                                <span className="text-[#87B2F4] font-normal relative inline-grid overflow-hidden py-1">
                                    <span
                                        className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${
                                            chatMode === 'agent'
                                                ? 'opacity-100 translate-y-0'
                                                : 'opacity-0 -translate-y-4 pointer-events-none'
                                        }`}
                                    >
                                        Agent
                                    </span>
                                    <span
                                        className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${
                                            chatMode === 'search'
                                                ? 'opacity-100 translate-y-0'
                                                : 'opacity-0 translate-y-4 pointer-events-none'
                                        }`}
                                    >
                                        Search
                                    </span>
                                </span>
                            </h2>
                        </div>
                        <div className="relative flex items-center bg-[#252525] rounded-full shadow-sm w-[94px] overflow-hidden mr-1.5 md:mr-2">
                            {/* Sliding Indicator */}
                            <div
                                className={`absolute left-0 top-0 bottom-0 w-1/2 rounded-full bg-[#87B2F4] transition-transform duration-300 ease-out shadow-sm ${
                                    chatMode === 'agent' ? 'translate-x-0' : 'translate-x-full'
                                }`}
                            />

                            <button
                                onClick={() => setChatMode('agent')}
                                className={`relative z-10 flex-1 flex justify-center items-center py-[4px] rounded-full text-[11px] transition-colors duration-300 ${
                                    chatMode === 'agent'
                                        ? 'text-[#111111] font-semibold'
                                        : 'text-[#B4B4B4] hover:text-[#E8E8E8] font-medium'
                                }`}
                            >
                                Agent
                            </button>
                            <button
                                onClick={() => setChatMode('search' as any)}
                                className={`relative z-10 flex-1 flex justify-center items-center py-[4px] rounded-full text-[11px] transition-colors duration-300 ${
                                    chatMode === 'search'
                                        ? 'text-[#111111] font-semibold'
                                        : 'text-[#B4B4B4] hover:text-[#E8E8E8] font-medium'
                                }`}
                            >
                                Search
                            </button>
                        </div>
                    </div>
                    <PromptInput
                        value={prompt}
                        onChange={setPrompt}
                        onSubmit={onPromptSubmit}
                        isLoading={isGenerating}
                        onUpload={() => canvasRef.current?.triggerImageUpload()}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                    />
                </div>
            </div>

            <OnboardingModal
                isOpen={showOnboarding}
                onClose={() => setShowOnboarding(false)}
                onConfirm={() => {
                    completeOnboardingMutation.mutate()
                    setShowOnboarding(false)
                }}
            />

            <ProUpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
        </main>
    )
}
