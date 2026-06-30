import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import React, { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip } from 'lucide-react'

import { GitHubRepoForm } from './GitHubRepoForm'
import { HomeHeader } from './HomeHeader'
import { OnboardingModal } from './OnboardingModal'
import PromptInput from './PromptInput'

import type { HomeHeroProps } from '@/features/home/types'

import { ProUpgradeModal } from '@/features/billing/components/ProUpgradeModal'
import Canvas, { type CanvasRef } from '@/features/canvas/components/Canvas'
import { profileAPI } from '@/features/profile/api/profile'
import { Icons } from '@/shared/components/ui/Icons'

export const HomeHero: React.FC<HomeHeroProps> = ({
    onPromptSubmit,
    isGenerating,
    isAuthenticated,
    onOpenAuth,
    canvasState,
    onCanvasStateChange,
    projectId,
    onImportGithub,
    onImportZip,
    importState,
    onResetImportState,
}) => {
    const navigate = useNavigate()
    const canvasRef = useRef<CanvasRef>(null)
    const [prompt, setPrompt] = React.useState('')
    const [activeImportForm, setActiveImportForm] = useState<'github' | null>(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [isUbuntuMenuOpen, setIsUbuntuMenuOpen] = useState(false)

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

            <div className="flex flex-col items-center justify-start pt-[22vh] md:pt-[27vh] h-full flex-1 gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto px-4 w-full shrink-0 relative">
                <div className="flex flex-col items-center gap-3 text-center relative -left-[8px]">
                    <div className="flex items-center gap-2.5 select-none">
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
                    <PromptInput
                        value={prompt}
                        onChange={setPrompt}
                        onSubmit={onPromptSubmit}
                        isLoading={isGenerating}
                        onUpload={() => canvasRef.current?.triggerImageUpload()}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                    />

                    {/* Import Integration */}
                    <div className="flex items-center justify-center gap-3 mt-6 animate-in fade-in duration-300 whitespace-nowrap">
                        <span className="text-[#656565] text-[14px] font-medium tracking-wide">
                            or start with
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => toggleImportForm('github')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed transition-all group ${
                                    activeImportForm === 'github'
                                        ? 'border-[#5A5A5A] bg-white/5 text-white'
                                        : 'border-[#404040] bg-transparent hover:bg-white/5 hover:border-[#5A5A5A] text-[#A1A1AA] hover:text-white'
                                }`}
                            >
                                <Icons.Github className="w-[12px] h-[12px] group-hover:text-white transition-colors" />
                                <span className="text-[11px]">GitHub Repo</span>
                            </button>
                            <button
                                onClick={handleTemplateClick}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-[#404040] bg-transparent hover:bg-white/5 hover:border-[#5A5A5A] text-[#A1A1AA] hover:text-white transition-all group"
                            >
                                <Icons.Bookmark className="w-[12px] h-[12px] group-hover:text-white transition-colors" />
                                <span className="text-[11px]">Template</span>
                            </button>
                        </div>
                    </div>

                    {/* Import Forms */}
                    <div className="flex justify-center">
                        <AnimatePresence mode="wait">
                            {activeImportForm === 'github' && (
                                <GitHubRepoForm
                                    key="github-form"
                                    onClose={() => {
                                        setActiveImportForm(null)
                                        onResetImportState?.()
                                    }}
                                    onSubmitRepo={onImportGithub}
                                    isImporting={importState?.status === 'loading'}
                                    importMessage={importState?.message}
                                    importError={
                                        importState?.status === 'failed'
                                            ? importState.message
                                            : null
                                    }
                                    onResetImportState={onResetImportState}
                                />
                            )}
                        </AnimatePresence>
                    </div>
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
