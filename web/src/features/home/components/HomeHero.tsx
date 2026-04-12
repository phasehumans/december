import React, { useRef, useEffect } from 'react'

import PromptInput from './PromptInput'
import { HomeHeader } from './HomeHeader'

import Canvas, { type CanvasRef } from '@/features/canvas/components/Canvas'
import { Icons } from '@/shared/components/ui/Icons'
import type { HomeHeroProps } from '@/features/home/types'

export const HomeHero: React.FC<HomeHeroProps> = ({
    onPromptSubmit,
    isGenerating,
    isAuthenticated,
    onOpenAuth,
    canvasState,
    onCanvasStateChange,
    projectId,
}) => {
    const canvasRef = useRef<CanvasRef>(null)
    const [prompt, setPrompt] = React.useState('')

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
    }, [])

    return (
        <main
            id="main-scroll-container"
            className="h-full min-h-0 overflow-y-auto no-scrollbar scroll-smooth relative flex flex-col"
        >
            <HomeHeader />

            <div className="flex flex-col items-center justify-start pt-[25vh] md:pt-[30vh] min-h-[100vh] md:min-h-[100vh] gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto px-4 w-full shrink-0 relative">
                <div className="flex flex-col items-center gap-4 text-center mb-2">
                    <h1 className="text-2xl md:text-4xl font-sohne font-medium tracking-tight text-[#D6D5D4] px-4">
                        What are we building today?
                    </h1>
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

                    {/* Suggestions */}
                    {/* <SuggestionsList
                        onSuggestionClick={setPrompt}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                    /> */}
                    {/* Import Integration */}
                    <div className="flex items-center justify-center gap-3 mt-8 opacity-0 animate-[fadeIn_1s_ease-out_0.5s_forwards] whitespace-nowrap">
                        <span className="text-[#656565] text-[14px] font-medium tracking-wide">
                            or start from
                        </span>
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-[#404040] bg-transparent hover:bg-white/5 hover:border-[#5A5A5A] text-[11px] text-[#A1A1AA] hover:text-white transition-all group">
                                <Icons.Github className="w-[12px] h-[12px] group-hover:text-white transition-colors" />
                                <span>GitHub Repo</span>
                            </button>
                            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-[#404040] bg-transparent hover:bg-white/5 hover:border-[#5A5A5A] text-[11px] text-[#A1A1AA] hover:text-white transition-all group">
                                <Icons.Code className="w-[12px] h-[12px] group-hover:text-white transition-colors" />
                                <span>Upload Project</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div
                id="hero-canvas-container"
                className="w-full h-screen bg-background relative shrink-0 p-2 mt-[60px]"
            >
                <div className="md:hidden w-full text-center pb-4 pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                        Best on Desktop
                    </span>
                </div>
                <div className="w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
                    <Canvas
                        ref={canvasRef}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                        document={canvasState}
                        onDocumentChange={onCanvasStateChange}
                        projectId={projectId}
                    />
                </div>
            </div>
        </main>
    )
}
