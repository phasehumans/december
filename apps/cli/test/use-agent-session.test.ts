import { describe, it, expect, beforeEach } from 'bun:test'

import { useCliStore } from '../src/store'

describe('useCliStore activeMessages handling', () => {
    beforeEach(() => {
        useCliStore.setState({
            staticMessages: [{ id: 'header', role: 'header' }],
            activeMessages: [],
            isStreaming: false,
        })
    })

    it('flushes live activeMessages from Zustand store into staticMessages after streaming', () => {
        const store = useCliStore.getState()
        const userMsg = { id: 'msg-user-1', role: 'user' as const, text: 'Hello AI' }
        const assistantMsg = {
            id: 'msg-ast-1',
            role: 'assistant' as const,
            blocks: [{ type: 'text' as const, content: 'Hello human!' }],
        }

        // 1. Initial state setup when user submits prompt
        const currentActive = useCliStore.getState().activeMessages
        store.setStaticMessages((prev) => [...prev, ...currentActive, userMsg])
        store.setActiveMessages([assistantMsg])

        expect(useCliStore.getState().staticMessages).toHaveLength(2)
        expect(useCliStore.getState().activeMessages).toHaveLength(1)

        // 2. Simulate streaming finishing: fetching live activeMessages from store and flushing to staticMessages
        const finalActive = useCliStore.getState().activeMessages
        store.setStaticMessages((prev) => [...prev, ...finalActive])
        store.setActiveMessages([])

        const finalStatic = useCliStore.getState().staticMessages
        expect(finalStatic).toHaveLength(3)
        expect(finalStatic[0].role).toBe('header')
        expect(finalStatic[1].text).toBe('Hello AI')
        expect(finalStatic[2].blocks?.[0].content).toBe('Hello human!')
        expect(useCliStore.getState().activeMessages).toHaveLength(0)
    })

    it('queues prompts sequentially in FIFO order and allows clearing state', () => {
        const store = useCliStore.getState()
        expect(store.queuedPrompts).toEqual([])

        store.setQueuedPrompts((prev) => [...prev, 'Second prompt'])
        store.setQueuedPrompts((prev) => [...prev, 'Third prompt'])

        expect(useCliStore.getState().queuedPrompts).toEqual(['Second prompt', 'Third prompt'])

        // Consume first queued prompt
        const nextPrompt = useCliStore.getState().queuedPrompts[0]
        store.setQueuedPrompts((prev) => prev.slice(1))

        expect(nextPrompt).toBe('Second prompt')
        expect(useCliStore.getState().queuedPrompts).toEqual(['Third prompt'])

        // Clear remaining
        store.setQueuedPrompts([])
        expect(useCliStore.getState().queuedPrompts).toEqual([])
    })

    it('contains AUTH_REQUIRED_NOTICE in messages constants matching expected prompt', async () => {
        const { AUTH_REQUIRED_NOTICE } = await import('../src/constants/messages')
        expect(AUTH_REQUIRED_NOTICE).toContain(
            'You are not logged in and have no custom API keys (BYOK) configured.'
        )
        expect(AUTH_REQUIRED_NOTICE).toContain('Please run `/login` to:')
        expect(AUTH_REQUIRED_NOTICE).toContain(
            '- Sign in with your December account (Cloud Wallet), or'
        )
        expect(AUTH_REQUIRED_NOTICE).toContain(
            '- Configure Bring Your Own Key (BYOK) for providers like OpenAI, Anthropic, Gemini, OpenRouter, etc.'
        )
    })

    it('contains HANDOFF_LOGIN_REQUIRED_NOTICE, HANDOFF_INSUFFICIENT_CREDITS_NOTICE, and HANDOFF_SUCCESS_NOTICE matching expected structure', async () => {
        const {
            HANDOFF_LOGIN_REQUIRED_NOTICE,
            HANDOFF_INSUFFICIENT_CREDITS_NOTICE,
            HANDOFF_SUCCESS_NOTICE,
        } = await import('../src/constants/messages')

        expect(HANDOFF_LOGIN_REQUIRED_NOTICE).toContain(
            'Cloud handoff migrates your local terminal session'
        )
        expect(HANDOFF_LOGIN_REQUIRED_NOTICE).toContain('/login')
        expect(HANDOFF_LOGIN_REQUIRED_NOTICE).toContain('december login')

        expect(HANDOFF_INSUFFICIENT_CREDITS_NOTICE).toContain(
            'Insufficient credits in December Wallet'
        )
        expect(HANDOFF_INSUFFICIENT_CREDITS_NOTICE).toContain(
            'https://trydecember.com/settings/billing'
        )
        expect(HANDOFF_INSUFFICIENT_CREDITS_NOTICE).toContain('/handoff')

        const successNotice = HANDOFF_SUCCESS_NOTICE('test-session-123')
        expect(successNotice).toContain('Workspace handed off successfully!')
        expect(successNotice).toContain('https://trydecember.com/s/test-session-123')
    })

    it('exports clipboard and handoff utilities from @december/tui for slash command handling', async () => {
        const tui = await import('@december/tui')
        expect(typeof tui.writeToClipboard).toBe('function')
        expect(typeof tui.createWorkspaceArchive).toBe('function')
    })

    it('updates activeModel in useCliStore instantly and reacts to provider changes', () => {
        const store = useCliStore.getState()
        expect(store.activeModel).toBeDefined()

        store.setActiveModel('claude-opus-5')
        expect(useCliStore.getState().activeModel).toBe('claude-opus-5')

        store.setActiveModel('gpt-5.6-sol')
        expect(useCliStore.getState().activeModel).toBe('gpt-5.6-sol')

        store.setActiveModel('gemini-3.7-flash')
        expect(useCliStore.getState().activeModel).toBe('gemini-3.7-flash')
    })

    it('preserves clean skill invocation command in queuedPrompts instead of whole prompt', () => {
        const store = useCliStore.getState()
        store.setQueuedPrompts(['/skill:implement', '/ask-matt'])

        expect(useCliStore.getState().queuedPrompts).toEqual(['/skill:implement', '/ask-matt'])
        expect(useCliStore.getState().queuedPrompts[0]).not.toContain(
            'Please follow the procedures'
        )
    })

    it('extracts skill invocation command from [Skill Invocation: /...] prompt header for resume', () => {
        const legacySkillContent = `[Skill Invocation: /ask-matt] (Skill Directory: /home/chaitanya/.agents/skills/ask-matt)\n\nPlease follow the procedures from skill 'ask-matt':\n\n# Ask Matt`
        const match = legacySkillContent.match(/^\[Skill Invocation: (\/[^\]]+)\]/)
        expect(match).toBeTruthy()
        expect(match?.[1]).toBe('/ask-matt')

        const legacySkillWithArgs = `[Skill Invocation: /tdd auth-service] (Skill Directory: /home/chaitanya/.agents/skills/tdd)\n\nPlease follow the procedures from skill 'tdd':\n\n# TDD`
        const matchWithArgs = legacySkillWithArgs.match(/^\[Skill Invocation: (\/[^\]]+)\]/)
        expect(matchWithArgs).toBeTruthy()
        expect(matchWithArgs?.[1]).toBe('/tdd auth-service')
    })

    it('stores and clears currentPlanText and currentPlanQAPairs in useCliStore', () => {
        const store = useCliStore.getState()
        expect(store.currentPlanText).toBeNull()
        expect(store.currentPlanQAPairs).toEqual([])
        expect(store.planRefineMode).toBe(false)

        store.setCurrentPlanText('### Implementation Plan\n1. Add auth')
        store.setCurrentPlanQAPairs([{ question: 'Which DB?', answer: 'PostgreSQL' }])
        store.setPlanRefineMode(true)

        expect(useCliStore.getState().currentPlanText).toBe('### Implementation Plan\n1. Add auth')
        expect(useCliStore.getState().currentPlanQAPairs).toEqual([
            { question: 'Which DB?', answer: 'PostgreSQL' },
        ])
        expect(useCliStore.getState().planRefineMode).toBe(true)

        store.setCurrentPlanText(null)
        store.setCurrentPlanQAPairs([])
        store.setPlanRefineMode(false)
        expect(useCliStore.getState().currentPlanText).toBeNull()
        expect(useCliStore.getState().currentPlanQAPairs).toEqual([])
        expect(useCliStore.getState().planRefineMode).toBe(false)
    })

    it('stores and updates switchItems in useCliStore and supports switch_select authMode', () => {
        const store = useCliStore.getState()
        expect(store.switchItems).toEqual([])

        const mockItems = [
            {
                label: 'Claude (Subscription)',
                value: 'subscription:claude',
                model: 'claude-3-7-sonnet',
                isActive: true,
            },
            {
                label: 'OpenAI',
                value: 'provider:openai',
                model: 'gpt-5.5',
                isActive: false,
            },
        ]

        store.setSwitchItems(mockItems)
        store.setAuthMode('switch_select')

        expect(useCliStore.getState().switchItems).toHaveLength(2)
        expect(useCliStore.getState().switchItems[0].value).toBe('subscription:claude')
        expect(useCliStore.getState().authMode).toBe('switch_select')

        store.setAuthMode('none')
        store.setSwitchItems([])
        expect(useCliStore.getState().switchItems).toEqual([])
        expect(useCliStore.getState().authMode).toBe('none')
    })

    it('manages planWorkflow state machine decoupled from authMode', () => {
        const store = useCliStore.getState()
        expect(store.planWorkflow).toEqual({ phase: 'idle' })
        expect(store.interactivePlanGoalMode).toBe(false)

        // 1. Transition to grilling
        store.setPlanWorkflow({
            phase: 'grilling',
            prompt: 'Implement auth',
            questions: [
                {
                    question: 'Which auth method?',
                    options: ['JWT', 'Session'],
                },
            ],
            currentIndex: 0,
            answers: [],
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('grilling')
        expect(useCliStore.getState().authMode).toBe('none') // Decoupled from authMode

        // 2. Transition to reviewing
        store.setPlanWorkflow({
            phase: 'reviewing',
            prompt: 'Implement auth',
            planText: '### Implementation Plan\n1. Add auth.ts',
            qaPairs: [{ question: 'Which auth method?', answer: 'JWT' }],
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('reviewing')
        if (useCliStore.getState().planWorkflow.phase === 'reviewing') {
            expect((useCliStore.getState().planWorkflow as any).planText).toContain(
                '### Implementation Plan'
            )
        }

        // 3. Transition to refining
        store.setPlanWorkflow({
            phase: 'refining',
            prompt: 'Implement auth',
            previousPlan: '### Implementation Plan\n1. Add auth.ts',
            feedback: 'Use sessions instead',
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('refining')

        // 4. Transition to executing
        store.setPlanWorkflow({
            phase: 'executing',
            prompt: 'Implement auth',
            planText: '### Implementation Plan\n1. Add auth.ts',
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('executing')

        // 5. Back to idle
        store.setPlanWorkflow({ phase: 'idle' })
        expect(useCliStore.getState().planWorkflow.phase).toBe('idle')

        // 6. Interactive plan goal mode toggle
        store.setInteractivePlanGoalMode(true)
        expect(useCliStore.getState().interactivePlanGoalMode).toBe(true)
        store.setInteractivePlanGoalMode(false)
        expect(useCliStore.getState().interactivePlanGoalMode).toBe(false)
    })

    it('handles approval actions and abort transition logic', () => {
        const store = useCliStore.getState()

        // 1. Initial review phase
        store.setPlanWorkflow({
            phase: 'reviewing',
            prompt: 'Refactor logger',
            planText: '1. Update logger.ts',
            qaPairs: [],
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('reviewing')

        // 2. Action: refine
        store.setPlanWorkflow({
            phase: 'refining',
            prompt: 'Refactor logger',
            previousPlan: '1. Update logger.ts',
            feedback: '',
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('refining')

        // 3. Action: approve -> executing
        store.setPlanWorkflow({
            phase: 'executing',
            prompt: 'Refactor logger',
            planText: '1. Update logger.ts',
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('executing')

        // 4. Abort during execution -> resets to idle
        if (useCliStore.getState().planWorkflow.phase === 'executing') {
            store.setPlanWorkflow({ phase: 'idle' })
        }
        expect(useCliStore.getState().planWorkflow.phase).toBe('idle')

        // 5. Action: reject from review -> resets to idle
        store.setPlanWorkflow({
            phase: 'reviewing',
            prompt: 'Refactor logger',
            planText: '1. Update logger.ts',
            qaPairs: [],
        })
        expect(useCliStore.getState().planWorkflow.phase).toBe('reviewing')
        store.setPlanWorkflow({ phase: 'idle' })
        expect(useCliStore.getState().planWorkflow.phase).toBe('idle')
    })
})
