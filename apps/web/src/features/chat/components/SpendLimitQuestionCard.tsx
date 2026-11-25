import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { InteractiveQuestionCard, type QuestionItem } from './InteractiveQuestionCard'

import { useAppStore } from '@/app/store'
import { generationAPI, getSharedSocket } from '@/features/generation/api/generation'
import { sessionAPI } from '@/features/sessions/api/session'
import { FOLLOW_RUN_EVENT } from '@/shared/lib/appEvents'

/** the answer that starts the run again. the other one is "Stop here" */
const CONTINUE = 'Continue'

// the run events after which the question of this session can be new or gone
const QUESTION_EVENTS = new Set(['SpendLimitQuestion', 'SpendLimitAnswered', 'AgentEnd'])

interface SpendLimitPrompt {
    source?: string
    questionId?: string
    questions?: QuestionItem[]
}

/**
 * The question of a session that is paused at a spend limit (#638): "Reached $5. Continue?"
 * with Continue and Stop here. The server saves it with the session, so it shows until the
 * user answers. "Continue" starts the run again: the chat then shows that run.
 */
export const SpendLimitQuestionCard: React.FC<{
    sessionId: string
    /** a run of this session started or ended in this tab: the question is read again */
    isRunning?: boolean
}> = ({ sessionId, isRunning = false }) => {
    const queryClient = useQueryClient()
    const setIsGenerating = useAppStore((state) => state.setIsGenerating)
    const setGenerationPhase = useAppStore((state) => state.setGenerationPhase)
    const setActiveOperation = useAppStore((state) => state.setActiveOperation)

    const queryKey = React.useMemo(() => ['session-limit-question', sessionId], [sessionId])
    const { data } = useQuery<SpendLimitPrompt | null>({
        queryKey,
        queryFn: () => sessionAPI.getPendingQuestion(sessionId),
        retry: false,
    })

    React.useEffect(() => {
        void queryClient.invalidateQueries({ queryKey })
    }, [isRunning, queryClient, queryKey])

    // the worker pauses the run while this session is open: read the question again
    React.useEffect(() => {
        const socket = getSharedSocket()
        const onAgentEvent = (event: { type?: string } | null) => {
            if (event?.type && QUESTION_EVENTS.has(event.type)) {
                void queryClient.invalidateQueries({ queryKey })
            }
        }
        socket.on('agent_event', onAgentEvent)
        return () => {
            socket.off('agent_event', onAgentEvent)
        }
    }, [queryClient, queryKey])

    const onAnswered = React.useCallback(
        (answer: string | string[]) => {
            void queryClient.invalidateQueries({ queryKey: ['sessions'] })
            if (answer !== CONTINUE) {
                queryClient.setQueryData(queryKey, null)
                return
            }
            // the server queued the run. the chat of the open session shows it live
            const followed = !window.dispatchEvent(
                new CustomEvent(FOLLOW_RUN_EVENT, { detail: { sessionId }, cancelable: true })
            )
            if (followed) {
                queryClient.setQueryData(queryKey, null)
                return
            }
            // no chat took it: wait for the run the way a running session is opened
            const runEnded = (phase: 'done' | null) => {
                setIsGenerating(false)
                setGenerationPhase(phase)
                setActiveOperation(null)
                void queryClient.invalidateQueries({ queryKey: ['sessions'] })
                void queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
                void queryClient.invalidateQueries({ queryKey })
            }
            queryClient.setQueryData(queryKey, null)
            setIsGenerating(true)
            setGenerationPhase('building')
            setActiveOperation('build')
            void generationAPI
                .listenToSessionStream(sessionId, (event) => {
                    if (event.type === 'AgentEnd' || event.type === 'result') runEnded('done')
                    else if (event.type === 'AgentError') runEnded(null)
                })
                .catch(() => {
                    // Intentionally swallowed: the run goes on without this tab watching it
                })
        },
        [queryClient, queryKey, sessionId, setActiveOperation, setGenerationPhase, setIsGenerating]
    )

    if (data?.source !== 'spend-limit' || !data.questions?.length) return null

    return (
        <InteractiveQuestionCard
            // a new question for the session is a new card
            key={`${data.questionId}:${data.questions[0]?.question}`}
            sessionId={sessionId}
            questionId={data.questionId}
            questions={data.questions}
            title="Spend limit"
            onAnswerSubmitted={onAnswered}
        />
    )
}
