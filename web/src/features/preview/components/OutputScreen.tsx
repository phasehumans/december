import React from 'react'

import { OutputScreenMainContent } from './OutputScreenMainContent'
import { PreviewArea } from './PreviewArea'

import type { Message } from '@/features/chat/types'
import type { OutputScreenProps } from '@/features/preview/types'
import type {
    GeneratedProjectFile,
    PreviewSessionStatus,
    OutputOperation,
} from '@/features/preview/types'

import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { billingAPI } from '@/features/billing/api/billing'
import { ChatThread as ChatSidebar } from '@/features/chat/components/ChatThread'
import { useOutputScreenController } from '@/features/preview/hooks/useOutputScreenController'

type MobileOutputTab = 'chat' | 'preview'

export const OutputScreen: React.FC<OutputScreenProps> = ({
    onBack,
    onPromptSubmit,
    onRuntimeError,
    messages,
    generatedFiles,
    activeGeneratedFilePath,
    generationPhase,
    activeOperation,
    isGenerating = false,
    showStructureOnly = false,
    projectName,
    projectId,
    canvasState,
    onCanvasStateChange,
    versions,
    activeVersionId,
    isVersionLoading,
    onSelectVersion,
    onDownload,
    previewSession,
    previewSessionError,
    projectType = 'generated',
    selectedModel,
    setSelectedModel,
}) => {
    const navigate = useNavigate()
    const { data: overview } = useQuery({
        queryKey: ['billing-overview'],
        queryFn: billingAPI.getOverview,
        staleTime: 10 * 1000,
    })

    const remainingInCents = overview?.credits?.remainingInCents ?? 100
    const unlimited = overview?.credits?.unlimited ?? false
    const isPro = overview?.plan === 'PRO'

    const isOutOfCredits = !unlimited && overview !== undefined && remainingInCents === 0
    const showLowCreditsWarning = !unlimited && remainingInCents > 0 && remainingInCents < 10

    const {
        activeTab,
        setActiveTab,
        device,
        setDevice,
        previewHtml,
        setPreviewHtml,
        isVisualMode,
        setIsVisualMode,
        selectedElement,
        editPrompt,
        setEditPrompt,
        isApplyingEdit,
        isChatSidebarCollapsed,
        setIsChatSidebarCollapsed,
        steps,
        isThoughtsOpen,
        setIsThoughtsOpen,
        executionTime,
        iframeRef,
        handleIframeMessage,
        handleApplyEdit,
        handleClearSelection,
        handleOpenInNewTab,
    } = useOutputScreenController({
        isGenerating,
        generatedFiles,
        activeGeneratedFilePath,
        generationPhase,
        activeOperation,
        onPromptSubmit,
        onRuntimeError,
        previewSession,
    })

    const [mobileActiveTab, setMobileActiveTab] = React.useState<MobileOutputTab>('chat')
    const handleBack = onBack || (() => {})

    // Simulation States for Developer Verification
    const [isSimulating, setIsSimulating] = React.useState<boolean>(false)
    const [simulatedMessages, setSimulatedMessages] = React.useState<Message[] | null>(null)
    const [simulatedFiles, setSimulatedFiles] = React.useState<Record<
        string,
        GeneratedProjectFile
    > | null>(null)
    const [simulatedPhase, setSimulatedPhase] = React.useState<
        'thinking' | 'building' | 'done' | null
    >(null)
    const [simulatedSession, setSimulatedSession] = React.useState<PreviewSessionStatus | null>(
        null
    )
    const [simulatedSessionError, setSimulatedSessionError] = React.useState<string | null>(null)
    const [simulatedProjectType, setSimulatedProjectType] = React.useState<
        'generated' | 'github' | 'zip'
    >('generated')
    const [simulatedIsGenerating, setSimulatedIsGenerating] = React.useState<boolean>(false)
    const [simulatedActiveFilePath, setSimulatedActiveFilePath] = React.useState<string | null>(
        null
    )
    const [simulatedActiveOperation, setSimulatedActiveOperation] =
        React.useState<OutputOperation | null>(null)
    const [simulatedSteps, setSimulatedSteps] = React.useState<string[]>([])
    const [simulatedExecutionTime, setSimulatedExecutionTime] = React.useState<number>(0)

    const handleTriggerSimulation = React.useCallback((type: 'generated' | 'github' | 'zip') => {
        setIsSimulating(true)
        setSimulatedIsGenerating(true)
        setSimulatedProjectType(type)
        setSimulatedPhase('thinking')
        setSimulatedActiveOperation('build')
        setSimulatedSteps([])
        setSimulatedExecutionTime(0)
        setSimulatedSessionError(null)
        setSimulatedSession({
            previewId: 'sim',
            projectId: 'sim',
            state: 'WaitingForRunnableVersion',
            backendStatus: 'rebuilding',
            updatedAt: new Date().toISOString(),
        })

        const userPrompt =
            type === 'generated'
                ? 'Generate a movie ticket booking website using Neon database and Stripe payments'
                : type === 'github'
                  ? 'Importing movie ticket booking codebase from GitHub repository'
                  : 'Uploading movie ticket booking ZIP codebase archive'

        const userMsg: Message = {
            id: 'sim-user',
            role: 'user',
            content: userPrompt,
        }

        const assistantMsg: Message = {
            id: 'sim-assistant',
            role: 'assistant',
            content: '',
            status: 'thinking',
        }

        setSimulatedMessages([userMsg, assistantMsg])
        setSimulatedFiles({})

        const startTime = Date.now()
        const timer = setInterval(() => {
            setSimulatedExecutionTime((Date.now() - startTime) / 1000)
        }, 100)

        // Phased Streaming Contents
        const thoughtsText = `The user has answered the questions. Let me summarize their requirements:

Database: Neon (Serverless PostgreSQL)
Payments: Yes, Stripe integration
Core Features:
• Browse & filter movies by genre/release date
• View showtimes by theater and date
• Interactive seat selection with layout

Now I should create a comprehensive plan for building this movie ticket booking website. I'll need to set up Neon database integration, design the schema for movies, theaters, showtimes, bookings, and seats, and integrate Stripe.`

        const planText = `### Plan of Action

I will execute the following steps to implement this movie ticket booking system:
- **Database Setup**: Set up Neon PostgreSQL with tables for \`User\`, \`Movie\`, \`Showtime\`, \`Booking\`, and \`Seat\`.
- **Interactive Seating**: Create a high-fidelity \`<SeatSelection>\` component with seat category blocks (VIP, Standard).
- **Payment Integration**: Implement Stripe checkout flows using Stripe elements sheets.
- **Frontend Shell**: Craft movie listings with Outfit typography, filtering, and smooth Framer Motion page transitions.`

        const summaryText = `I have successfully built the Movie Ticket Booking system with fully integrated Neon DB schema, Stripe payments, and interactive seating layout. Here is a summary of the changes:

1. **Database Schema & Server Config**:
   • Created \`prisma/schema.prisma\` with robust tables for \`User\`, \`Movie\`, \`Showtime\`, \`Booking\`, and \`Seat\`.
   • Initialized Neon database adapters.
2. **Interactive Seating Layout (\`src/components/SeatSelection.tsx\`)**:
   • Implemented state-managed grid grid supporting category blocks (VIP, Standard), occupied states, and real-time total calculator.
3. **Stripe Integration & Checkout (\`src/components/CheckoutForm.tsx\`)**:
   • Added complete payment element sheets, secure client keys, and booking webhook endpoints.
4. **Frontend Architecture & Navigation**:
   • Tailored movie browsing with smooth animations, genre tags, responsive carousels, and Outfit typography.`

        const operationSteps =
            type === 'generated'
                ? [
                      'Analyzing request intent',
                      'Locking implementation plan',
                      'Preparing build order',
                      'Streaming file generation',
                  ]
                : type === 'github'
                  ? [
                        'Connecting to repository',
                        'Fetching metadata',
                        'Resolving dependencies',
                        'Analyzing code structure',
                    ]
                  : [
                        'Uploading archive',
                        'Extracting source files',
                        'Resolving bundle specs',
                        'Analyzing project config',
                    ]

        let stepIndex = 0
        const stepInterval = setInterval(() => {
            if (stepIndex < operationSteps.length) {
                setSimulatedSteps((prev) => [...prev, operationSteps[stepIndex]!])
                stepIndex++
            } else {
                clearInterval(stepInterval)
            }
        }, 800)

        // Phased Streaming Timer
        // Phase 1: Stream Thoughts
        let tCharIdx = 0
        const thoughtsTimer = setInterval(() => {
            if (tCharIdx <= thoughtsText.length) {
                const currentThoughtsText = thoughtsText.substring(0, tCharIdx)
                setSimulatedMessages((prev) => {
                    if (!prev) return null
                    return prev.map((m) =>
                        m.id === 'sim-assistant' ? { ...m, content: currentThoughtsText } : m
                    )
                })
                tCharIdx += 5
            } else {
                clearInterval(thoughtsTimer)

                // Phase 2: Stream Plan of Action (as normal body text)
                setTimeout(() => {
                    setSimulatedMessages((prev) => {
                        if (!prev) return null
                        return prev.map((m) =>
                            m.id === 'sim-assistant'
                                ? { ...m, thoughts: thoughtsText, content: '' }
                                : m
                        )
                    })

                    let pCharIdx = 0
                    const planTimer = setInterval(() => {
                        if (pCharIdx <= planText.length) {
                            const currentPlanText = planText.substring(0, pCharIdx)
                            setSimulatedMessages((prev) => {
                                if (!prev) return null
                                return prev.map((m) =>
                                    m.id === 'sim-assistant'
                                        ? { ...m, content: currentPlanText }
                                        : m
                                )
                            })
                            pCharIdx += 5

                            const progressRatio = pCharIdx / planText.length
                            if (progressRatio > 0.35 && progressRatio < 0.4) {
                                setSimulatedSession((prev) =>
                                    prev ? { ...prev, state: 'Bootstrapping' } : null
                                )
                            }
                            if (progressRatio > 0.7 && progressRatio < 0.75) {
                                setSimulatedSession((prev) =>
                                    prev ? { ...prev, state: 'Installing' } : null
                                )
                            }
                        } else {
                            clearInterval(planTimer)

                            // Phase 3: Transition to Building Phase and output file changes list
                            setTimeout(() => {
                                setSimulatedPhase('building')
                                setSimulatedMessages((prev) => {
                                    if (!prev) return null
                                    return prev.map((m) =>
                                        m.id === 'sim-assistant'
                                            ? {
                                                  ...m,
                                                  plan: planText,
                                                  status: 'building',
                                                  content: '',
                                              }
                                            : m
                                    )
                                })

                                const filesToGenerate = [
                                    {
                                        path: 'prisma/schema.prisma',
                                        purpose: 'Database structure mapping models',
                                        generator: 'prisma',
                                    },
                                    {
                                        path: 'src/components/ui/dotm-square-15.tsx',
                                        purpose: 'Helix glow dot matrix animation component',
                                        generator: 'react',
                                    },
                                    {
                                        path: 'src/components/SeatSelection.tsx',
                                        purpose: 'Interactive layout seat grid component',
                                        generator: 'react',
                                    },
                                    {
                                        path: 'src/components/CheckoutForm.tsx',
                                        purpose: 'Stripe payment checkout integration card',
                                        generator: 'stripe',
                                    },
                                    {
                                        path: 'src/features/chat/components/ChatMessage.tsx',
                                        purpose: 'Multi-phase streamlined chat content component',
                                        generator: 'react',
                                    },
                                    {
                                        path: 'src/features/preview/components/PreviewArea.tsx',
                                        purpose:
                                            'Minimal checklists & floating warning compiler error viewport',
                                        generator: 'react',
                                    },
                                    {
                                        path: 'src/App.tsx',
                                        purpose: 'Main router and routing configuration',
                                        generator: 'vite',
                                    },
                                ]

                                let fileIdx = 0
                                const generateNextFile = () => {
                                    if (fileIdx < filesToGenerate.length) {
                                        const file = filesToGenerate[fileIdx]!

                                        // 1. Mark current file as building
                                        setSimulatedFiles((prev) => ({
                                            ...prev,
                                            [file.path]: {
                                                path: file.path,
                                                content: `// Generating ${file.path}...\n`,
                                                status: 'building',
                                                purpose: file.purpose,
                                                generator: file.generator,
                                            },
                                        }))
                                        setSimulatedActiveFilePath(file.path)
                                        setSimulatedActiveOperation('build')

                                        if (fileIdx === 2) {
                                            setSimulatedSession((prev) =>
                                                prev ? { ...prev, state: 'Starting' } : null
                                            )
                                        }

                                        // 2. Wait 3.0 seconds, then mark as done and move to next file
                                        setTimeout(() => {
                                            const completedPath = file.path
                                            setSimulatedFiles((prev) => {
                                                if (!prev) return prev
                                                const curr = prev[completedPath]
                                                if (!curr) return prev
                                                return {
                                                    ...prev,
                                                    [completedPath]: {
                                                        ...curr,
                                                        status: 'done',
                                                        content: `// Completed ${completedPath}\n`,
                                                    },
                                                }
                                            })

                                            fileIdx++
                                            generateNextFile()
                                        }, 3000)
                                    } else {
                                        // All files generated! Move to Phase 4: Stream Final Summary of changes made
                                        setTimeout(() => {
                                            setSimulatedPhase('done')
                                            setSimulatedMessages((prev) => {
                                                if (!prev) return null
                                                return prev.map((m) =>
                                                    m.id === 'sim-assistant'
                                                        ? { ...m, status: 'done', content: '' }
                                                        : m
                                                )
                                            })

                                            let sCharIdx = 0
                                            const summaryTimer = setInterval(() => {
                                                if (sCharIdx <= summaryText.length) {
                                                    const currentSummaryText =
                                                        summaryText.substring(0, sCharIdx)
                                                    setSimulatedMessages((prev) => {
                                                        if (!prev) return null
                                                        return prev.map((m) =>
                                                            m.id === 'sim-assistant'
                                                                ? {
                                                                      ...m,
                                                                      content: currentSummaryText,
                                                                  }
                                                                : m
                                                        )
                                                    })
                                                    sCharIdx += 6
                                                } else {
                                                    clearInterval(summaryTimer)
                                                    clearInterval(timer)

                                                    // Phase 5: Reveal sleek actions feedback and final pill footer details
                                                    setSimulatedIsGenerating(false)
                                                    setSimulatedPhase('done')
                                                    setSimulatedMessages((prev) => {
                                                        if (!prev) return null
                                                        return prev.map((m) =>
                                                            m.id === 'sim-assistant'
                                                                ? {
                                                                      ...m,
                                                                      summary: summaryText,
                                                                      tokensUsed: 14850,
                                                                      creditsUsed: 0.022,
                                                                      modelName:
                                                                          'Gemini 3.5 Flash (Medium)',
                                                                  }
                                                                : m
                                                        )
                                                    })

                                                    setSimulatedSession((prev) =>
                                                        prev
                                                            ? {
                                                                  ...prev,
                                                                  state: 'Healthy',
                                                                  backendStatus: 'ready',
                                                                  previewUrl:
                                                                      'https://preview-sample.december.dev/movies',
                                                              }
                                                            : null
                                                    )
                                                }
                                            }, 25)
                                        }, 800)
                                    }
                                }

                                // Start sequential file generation
                                generateNextFile()
                            }, 800)
                        }
                    }, 25)
                }, 800)
            }
        }, 25)
    }, [])

    const handleTriggerErrorSimulation = React.useCallback(() => {
        setIsSimulating(true)
        setSimulatedIsGenerating(false)
        setSimulatedSession(null)
        setSimulatedSessionError(null)

        setSimulatedSession({
            previewId: 'sim-err',
            projectId: 'sim-err',
            state: 'Failed',
            backendStatus: 'failed',
            lastError: {
                class: 'stable_compile_runtime',
                code: 'ERR_VITE_COMPILATION_FAILED',
                message:
                    'Failed to compile: src/components/SeatSelection.tsx: Unexpected token, expected "," (12:24)',
                detail: 'SyntaxError: Unexpected token, expected "," (12:24)\n  10 |   const selectSeat = (id: string) => {\n  11 |     setSelectedSeats(prev => {\n> 12 |       if (prev.includes(id) {\n     |                            ^\n  13 |         return prev.filter(x => x !== id);\n  14 |       }\n  15 |       return [...prev, id];',
                retryable: true,
            },
            updatedAt: new Date().toISOString(),
        })
    }, [])

    // Map properties to simulation when active
    const activeMessages = isSimulating && simulatedMessages ? simulatedMessages : messages
    const activeFiles = isSimulating && simulatedFiles ? simulatedFiles : generatedFiles
    const activePhase = isSimulating ? simulatedPhase : generationPhase
    const activeIsGenerating = isSimulating ? simulatedIsGenerating : isGenerating
    const activePreviewSession = isSimulating ? simulatedSession : previewSession
    const activePreviewSessionError = isSimulating ? simulatedSessionError : previewSessionError
    const activeProjectType = isSimulating ? simulatedProjectType : projectType
    const activeSteps = isSimulating ? simulatedSteps : steps
    const activeExecutionTime = isSimulating ? simulatedExecutionTime : executionTime
    const activeActiveFilePath = isSimulating ? simulatedActiveFilePath : activeGeneratedFilePath
    const activeOperationType = isSimulating ? simulatedActiveOperation : activeOperation

    return (
        <div className="w-full h-full bg-black text-white font-sans overflow-hidden relative">
            <div className="md:hidden flex h-full min-h-0 flex-col bg-[#171615]">
                <div className="flex-1 min-h-0 px-2 pt-2 pb-2 overflow-hidden">
                    <div
                        className={
                            mobileActiveTab === 'chat' ? 'h-full min-h-0' : 'hidden h-full min-h-0'
                        }
                    >
                        <ChatSidebar
                            mode="mobile"
                            messages={activeMessages}
                            onPromptSubmit={(prompt) => {
                                if (isOutOfCredits) return
                                void onPromptSubmit(prompt)
                            }}
                            onBack={handleBack}
                            isGenerating={activeIsGenerating}
                            steps={activeSteps}
                            executionTime={activeExecutionTime}
                            isThoughtsOpen={isThoughtsOpen}
                            setIsThoughtsOpen={setIsThoughtsOpen}
                            editPrompt={editPrompt}
                            setEditPrompt={setEditPrompt}
                            handleApplyEdit={() => {
                                void handleApplyEdit()
                            }}
                            isVisualMode={isVisualMode}
                            setIsVisualMode={setIsVisualMode}
                            selectedElement={selectedElement}
                            handleClearSelection={handleClearSelection}
                            isApplyingEdit={isApplyingEdit}
                            isCollapsed={false}
                            onClose={() => {}}
                            projectName={projectName}
                            generatedFiles={activeFiles}
                            projectType={activeProjectType}
                            onTriggerSimulation={handleTriggerSimulation}
                        />
                    </div>

                    <div
                        className={
                            mobileActiveTab === 'preview'
                                ? 'h-full min-h-0 flex'
                                : 'hidden h-full min-h-0 flex'
                        }
                    >
                        <PreviewArea
                            html={previewHtml}
                            isGenerating={activeIsGenerating}
                            device="desktop"
                            isVisualMode={isVisualMode}
                            onMessage={handleIframeMessage}
                            iframeRef={iframeRef}
                            fullscreen
                            showStructureOnly={showStructureOnly}
                            previewUrl={activePreviewSession?.previewUrl}
                            previewState={activePreviewSession?.state ?? null}
                            previewError={activePreviewSession?.lastError ?? null}
                            previewSessionError={activePreviewSessionError}
                            projectType={activeProjectType}
                        />
                    </div>
                </div>

                <div className="shrink-0 px-2 pb-2">
                    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#171615] p-1">
                        <button
                            onClick={() => setMobileActiveTab('chat')}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                mobileActiveTab === 'chat'
                                    ? 'bg-[#2B2B2B] text-white'
                                    : 'text-[#91908F] hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => setMobileActiveTab('preview')}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                mobileActiveTab === 'preview'
                                    ? 'bg-[#2B2B2B] text-white'
                                    : 'text-[#91908F] hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Preview
                        </button>
                    </div>
                </div>
            </div>

            <div className="hidden md:flex w-full h-full overflow-hidden">
                <ChatSidebar
                    messages={activeMessages}
                    onPromptSubmit={(prompt) => {
                        if (isOutOfCredits) return
                        void onPromptSubmit(prompt)
                    }}
                    onBack={handleBack}
                    isGenerating={activeIsGenerating}
                    steps={activeSteps}
                    executionTime={activeExecutionTime}
                    isThoughtsOpen={isThoughtsOpen}
                    setIsThoughtsOpen={setIsThoughtsOpen}
                    editPrompt={editPrompt}
                    setEditPrompt={setEditPrompt}
                    handleApplyEdit={() => {
                        void handleApplyEdit()
                    }}
                    isVisualMode={isVisualMode}
                    setIsVisualMode={setIsVisualMode}
                    selectedElement={selectedElement}
                    handleClearSelection={handleClearSelection}
                    isApplyingEdit={isApplyingEdit}
                    isCollapsed={isChatSidebarCollapsed}
                    onClose={() => setIsChatSidebarCollapsed(true)}
                    projectName={projectName}
                    generatedFiles={activeFiles}
                    projectType={activeProjectType}
                    onTriggerSimulation={handleTriggerSimulation}
                />

                <OutputScreenMainContent
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    device={device}
                    setDevice={setDevice}
                    isChatSidebarCollapsed={isChatSidebarCollapsed}
                    onToggleSidebar={() => setIsChatSidebarCollapsed(!isChatSidebarCollapsed)}
                    onOpenInNewTab={handleOpenInNewTab}
                    onBack={onBack}
                    previewHtml={previewHtml}
                    setPreviewHtml={setPreviewHtml}
                    generatedFiles={activeFiles}
                    activeGeneratedFilePath={activeActiveFilePath}
                    isGenerating={activeIsGenerating}
                    isVisualMode={isVisualMode}
                    iframeRef={iframeRef}
                    onIframeMessage={handleIframeMessage}
                    showStructureOnly={showStructureOnly}
                    projectName={projectName}
                    projectId={projectId}
                    canvasState={canvasState}
                    onCanvasStateChange={onCanvasStateChange}
                    versions={versions}
                    activeVersionId={activeVersionId}
                    isVersionLoading={isVersionLoading}
                    onSelectVersion={onSelectVersion}
                    onDownload={onDownload}
                    previewSession={activePreviewSession}
                    previewSessionError={activePreviewSessionError}
                    projectType={activeProjectType}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                />
            </div>

            {/* Low Credits Warning Toast */}
            {showLowCreditsWarning && !isOutOfCredits && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-2 rounded-xl text-sm font-medium shadow-xl flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Low Credits! You have less than $0.10 remaining.
                </div>
            )}

            {/* Out of Credits Upgrade Card Overlay */}
            {isOutOfCredits && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#171615] border border-[#242323] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-[#242323] flex flex-col gap-2">
                            <h2 className="text-xl font-medium text-[#D6D5C9]">Out of Credits</h2>
                            <p className="text-sm text-[#7B7A79]">
                                You have used all your available credits. Upgrade to Pro to continue
                                generating.
                            </p>
                        </div>

                        <div className="p-6 bg-[#100E12]/30 flex flex-col md:flex-row gap-5">
                            {/* Free Plan */}
                            <div className="flex-1 rounded-xl border border-[#242323] p-5 flex flex-col justify-between opacity-50">
                                <div>
                                    <div className="mb-2">
                                        <span className="text-[15px] font-medium text-[#D6D5C9]">
                                            Free Plan
                                        </span>
                                    </div>
                                    <div className="mb-4">
                                        <span className="text-[22px] font-semibold text-[#D6D5C9]">
                                            $0
                                        </span>
                                        <span className="text-[#7B7A79] text-[12px] ml-1">
                                            / month
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-2.5 text-[13px] text-[#7B7A79]">
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span>$1.00 standard credit limit</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <span>Standard execution speed</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pro Plan */}
                            <div className="flex-1 rounded-xl border border-[#D6D5C9]/40 bg-[#D6D5C9]/5 p-5 flex flex-col justify-between relative overflow-hidden">
                                <div>
                                    <div className="mb-2">
                                        <span className="text-[15px] font-medium text-[#D6D5C9]">
                                            Pro Plan
                                        </span>
                                    </div>
                                    <div className="mb-4">
                                        <span className="text-[22px] font-semibold text-[#D6D5C9]">
                                            $5
                                        </span>
                                        <span className="text-[#7B7A79] text-[12px] ml-1">
                                            / month
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-2.5 text-[13px] text-[#D6D5C9]">
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                            <span>$5.00 monthly credit refreshes</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                            <span>Priority execution speed</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/profile/billing')}
                                    className="w-full mt-6 py-2.5 rounded-lg bg-[#D6D5C9] text-[#171615] text-[14px] font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
                                >
                                    Upgrade to Pro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
