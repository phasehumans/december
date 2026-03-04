import React, { useRef } from 'react'
import PromptInput from '../../PromptInput'
import Canvas, { type CanvasRef } from '../../canvas/Canvas'
import { HomeHeader } from './HomeHeader'
import { SuggestionsList } from './SuggestionsList'

interface HomeHeroProps {
    onPromptSubmit: (prompt: string) => void
    isGenerating: boolean
    isAuthenticated: boolean
    onOpenAuth: () => void
}

export const HomeHero: React.FC<HomeHeroProps> = ({
    onPromptSubmit,
    isGenerating,
    isAuthenticated,
    onOpenAuth,
}) => {
    const canvasRef = useRef<CanvasRef>(null)
    const [prompt, setPrompt] = React.useState('')

    return (
        <main className="h-full min-h-0 overflow-y-auto no-scrollbar scroll-smooth relative flex flex-col">
            <HomeHeader />

            <div className="flex flex-col items-center justify-center pt-16 md:pt-0 h-[65vh] md:h-[85vh] min-h-[450px] md:min-h-[500px] gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto px-4 w-full shrink-0">
                <div className="flex flex-col items-center gap-4 text-center mb-2">
                    <h1 className="text-2xl md:text-4xl font-sohne font-medium tracking-tight text-[#D6D5D4] px-4">
                        What are we building today?
                    </h1>
                </div>
                <div className="w-full max-w-[638px] px-2 md:px-0">
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
                    <SuggestionsList
                        onSuggestionClick={setPrompt}
                        isAuthenticated={isAuthenticated}
                        onOpenAuth={onOpenAuth}
                    />
                </div>
            </div>

            <div className="w-full h-screen bg-background relative shrink-0 p-2">
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
                    />
                </div>
            </div>
        </main>
    )
}
