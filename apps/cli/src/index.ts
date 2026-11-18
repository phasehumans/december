#!/usr/bin/env node

import pkg from '../package.json' with { type: 'json' }

const rawArgs = process.argv.slice(2)
if (rawArgs.length === 1 && (rawArgs[0] === '-v' || rawArgs[0] === '--version')) {
    console.log(pkg.version)
    process.exit(0)
}

import path from 'node:path'

import { parseCliArgs, getHelpText } from './args'
import { AUTH_REQUIRED_NOTICE } from './constants/messages'
import releaseHighlights from './constants/release-highlights.json' with { type: 'json' }
import { purgeProjectEnvApiKeys } from './utils/env-sanitizer'

import type { DecemberConfig } from './config'
import type { DifferentialApp, TaskItem } from '@december/tui'

// Ensure no API keys or tokens from project .env files are loaded into CLI process
purgeProjectEnvApiKeys()

export { parseCliArgs, getHelpText } from './args'
export { purgeProjectEnvApiKeys } from './utils/env-sanitizer'

export async function readPipedStdin(): Promise<string | null> {
    if (process.stdin.isTTY) return null

    return new Promise((resolve) => {
        let data = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => {
            data += chunk
        })
        process.stdin.on('end', () => {
            resolve(data.trim() ? data : null)
        })
        process.stdin.on('error', () => {
            resolve(null)
        })
    })
}

async function main() {
    process.title = 'december'
    const isPrintArg = process.argv.includes('--print')
    if (process.stdout.isTTY && !isPrintArg) {
        process.stdout.write('\x1b]0;december\x07')
    }

    // If the terminal inherited NODE_ENV=test from prior test scripts, reset to development
    // so the live CLI doesn't accidentally redirect configuration to /tmp/december-test-config
    if (process.env.NODE_ENV === 'test' && !process.env.DECEMBER_CONFIG_DIR) {
        process.env.NODE_ENV = 'development'
    }

    const parsedArgs = parseCliArgs(process.argv.slice(2))

    // Fast-path 1: Help flag (< 5ms)
    if (parsedArgs.isHelp) {
        const { loadMcpConfigSync } = await import('@december/tools')
        const mcpServers = loadMcpConfigSync({ workspaceDir: parsedArgs.cwd || process.cwd() })
        console.log(getHelpText(pkg.version, { mcpServers }))
        process.exit(0)
    }

    // Fast-path 2: Version flag (< 5ms)
    if (parsedArgs.isVersion) {
        console.log(pkg.version)
        process.exit(0)
    }

    if (parsedArgs.cwd) {
        process.chdir(parsedArgs.cwd)
        purgeProjectEnvApiKeys(parsedArgs.cwd)
    }

    // Ingest non-TTY piped standard input into prompt if present
    const pipedStdin = await readPipedStdin()
    if (pipedStdin) {
        const formattedStdin = `<piped_stdin>\n${pipedStdin}\n</piped_stdin>`
        if (parsedArgs.prompt) {
            parsedArgs.prompt = `${parsedArgs.prompt}\n\n${formattedStdin}`
        } else {
            parsedArgs.prompt = formattedStdin
        }
    }

    // Fast-path 3: Standalone subcommands (lazy loaded)
    if (parsedArgs.command === 'auth') {
        const action = parsedArgs.positionals[1] || 'status'
        const { handleAuthCommand } = await import('./commands')
        await handleAuthCommand({ action })
        process.exit(0)
    }

    if (parsedArgs.command === 'mcp') {
        const action = parsedArgs.positionals[1] || 'list'
        const name = parsedArgs.positionals[2]
        const target = parsedArgs.positionals[3]
        const args = parsedArgs.positionals.slice(4)
        const { handleMcpCommand } = await import('./commands')
        await handleMcpCommand({
            action,
            name,
            target,
            args,
            scope: parsedArgs.scope,
            isGlobal: parsedArgs.isGlobal,
            env: parsedArgs.env,
            headers: parsedArgs.header,
            eager: parsedArgs.eager,
        })
        process.exit(0)
    }

    if (parsedArgs.command === 'link') {
        const targetProvider = parsedArgs.positionals[1]
        const { handleLinkCommand } = await import('./commands')
        await handleLinkCommand({ provider: targetProvider })
        process.exit(0)
    }

    if (parsedArgs.command === 'key') {
        const targetProvider = parsedArgs.positionals[1]
        const key = parsedArgs.positionals[2]
        const { handleKeyCommand } = await import('./commands')
        await handleKeyCommand({ provider: targetProvider, key, baseUrl: parsedArgs.baseUrl })
        process.exit(0)
    }

    if (parsedArgs.command === 'logout') {
        const targetProvider = parsedArgs.positionals[1]
        const { handleLogoutCommand } = await import('./commands')
        await handleLogoutCommand({ provider: targetProvider })
        process.exit(0)
    }

    if (parsedArgs.command === 'switch') {
        const targetProvider = parsedArgs.positionals[1]
        const { handleSwitchCommand } = await import('./commands')
        await handleSwitchCommand({ provider: targetProvider })
        process.exit(process.exitCode || 0)
    }

    if (parsedArgs.command === 'login') {
        const rawArg = parsedArgs.positionals[1]
        const isTokenArg = rawArg && (rawArg.startsWith('ey') || rawArg.length > 50)
        const targetProvider = isTokenArg ? undefined : rawArg
        const targetToken = parsedArgs.token || (isTokenArg ? rawArg : undefined)

        const { handleLoginCommand } = await import('./commands')
        await handleLoginCommand({ provider: targetProvider, token: targetToken })
        process.exit(0)
    }

    if (parsedArgs.command === 'init' || parsedArgs.positionals[0] === 'init') {
        console.log(
            '\nThe "init" command has been removed. December does not scaffold a .december directory in project roots.\nTo define project-specific instructions, create an AGENTS.md file in your project root.\n'
        )
        process.exit(0)
    }

    if (parsedArgs.command === 'update') {
        const { handleUpdateCommand } = await import('./commands')
        await handleUpdateCommand({ force: parsedArgs.force })
        process.exit(process.exitCode || 0)
    }

    if (parsedArgs.command === 'doctor') {
        const { handleDoctorCommand } = await import('./commands')
        await handleDoctorCommand({ fix: parsedArgs.fix })
        process.exit(0)
    }

    if (parsedArgs.command === 'changelog') {
        const { handleChangelogCommand } = await import('./commands')
        await handleChangelogCommand()
        process.exit(0)
    }

    if (parsedArgs.command === 'docs') {
        const section = parsedArgs.positionals[1]
        const { handleDocsCommand } = await import('./commands')
        await handleDocsCommand({ section })
        process.exit(0)
    }

    if (parsedArgs.command === 'open') {
        const targetPath = parsedArgs.positionals[1]
        const { handleOpenCommand } = await import('./commands')
        await handleOpenCommand({ path: targetPath })
        process.exit(process.exitCode || 0)
    }

    if (parsedArgs.command === 'codesearch') {
        const query = parsedArgs.positionals.slice(1).join(' ')
        const { handleCodeSearchCommand } = await import('./commands')
        await handleCodeSearchCommand({ query })
        process.exit(process.exitCode || 0)
    }

    if (parsedArgs.command === 'rewind' || parsedArgs.command === 'undo') {
        const turnArg = parsedArgs.positionals[1]
        const turn =
            turnArg && !isNaN(parseInt(turnArg, 10)) ? parseInt(turnArg, 10) : parsedArgs.turn
        const list = parsedArgs.positionals[1] === 'list' || parsedArgs.list
        const { handleRewindCommand } = await import('./commands')
        await handleRewindCommand({ turn, list })
        process.exit(0)
    }

    if (parsedArgs.command === 'skill' || parsedArgs.command === 'skills') {
        const { handleSkillCommand } = await import('./commands')
        await handleSkillCommand({
            action: parsedArgs.positionals[1],
            target: parsedArgs.positionals[2],
            isGlobal: parsedArgs.isGlobal,
        })
        process.exit(process.exitCode || 0)
    }

    const isAskMode = parsedArgs.command === 'ask'
    if (isAskMode) {
        const question = parsedArgs.positionals.slice(1).join(' ').trim() || parsedArgs.prompt
        if (!question) {
            console.error('Error: Please provide a question to ask.')
            console.error('Usage: december ask "<question>"\n')
            process.exit(1)
        }
        parsedArgs.prompt = question
    }

    const isHeadless = Boolean(parsedArgs.prompt || parsedArgs.rpc || parsedArgs.print)

    // Safety: Verify workspace trust before executing headless tasks or entering interactive TUI
    const { ensureWorkspaceTrust } = await import('./utils/workspace-trust')
    await ensureWorkspaceTrust({
        targetDir: parsedArgs.scope,
        isHeadless,
    })

    // Path 4: Headless Task / RPC Execution (Load agent harness & tools, skip Ink/React/TUI)
    if (isHeadless) {
        if (parsedArgs.print && !parsedArgs.prompt) {
            console.error('Error: Please provide a prompt or pipe input when using --print.\n')
            process.exit(1)
        }
        const [
            { AgentHarness },
            { openaiProvider },
            toolsModule,
            { FileSessionRepository },
            { getProviderConfig, loadConfig },
            { runHeadlessTask },
            { localOperations, setActiveScopeDir },
            { instantiateProvider },
            { ensureValidModelForProvider },
            { getAskPrompt },
        ] = await Promise.all([
            import('@december/agent'),
            import('@december/providers'),
            import('@december/tools'),
            import('./file-session-repository'),
            import('./config'),
            import('./headless-runner'),
            import('./local-operations'),
            import('./utils/provider-factory'),
            import('./utils/models'),
            import('./constants/prompts'),
        ])

        if (parsedArgs.scope) {
            setActiveScopeDir(parsedArgs.scope)
            purgeProjectEnvApiKeys(parsedArgs.scope)
        }

        const providerConfig = await getProviderConfig()
        let llm: any
        if (providerConfig) {
            llm = instantiateProvider(providerConfig.provider, providerConfig.apiKey, {
                authMethod: providerConfig.authMethod,
                subscription: providerConfig.subscription,
                headers: providerConfig.headers,
                baseURL: providerConfig.baseURL,
            })
        } else {
            llm = openaiProvider(undefined, 'dummy-key')
        }

        const sessionRepository = new FileSessionRepository()
        let targetSessionId = parsedArgs.sessionId
        if (parsedArgs.resume && !targetSessionId) {
            const sessions = await sessionRepository.listSessions()
            if (sessions.length > 0) {
                targetSessionId = sessions[0].id
            }
        }
        const sessionId = targetSessionId || `session-${Date.now()}`
        const config = await loadConfig()
        const activeProvider = providerConfig?.provider || config.activeProvider || 'gemini'
        const initialModel =
            providerConfig?.authMethod === 'december'
                ? 'december-auto'
                : parsedArgs.model ||
                  providerConfig?.model ||
                  ensureValidModelForProvider(activeProvider, config.activeModel)

        const effectiveTools = isAskMode
            ? [
                  toolsModule.ReadFileTool,
                  toolsModule.LsTool,
                  toolsModule.FindFilesTool,
                  toolsModule.GrepSearchTool,
                  toolsModule.AskQuestionTool,
                  toolsModule.SearchToolsTool,
              ]
            : toolsModule.CORE_TOOLS

        const deferredTools = isAskMode ? [] : toolsModule.DEFERRED_TOOLS
        const workspaceDir = parsedArgs.scope
            ? path.resolve(process.cwd(), parsedArgs.scope)
            : process.cwd()
        const mcpClientManager = new toolsModule.McpClientManager({ workspaceDir })
        const mcpConfigs = await toolsModule.loadMcpConfig({ workspaceDir })
        if (Object.keys(mcpConfigs).length > 0) {
            await mcpClientManager.connectAll(mcpConfigs).catch(() => {
                // Intentionally swallowed: MCP connection error fallback
            })
        }

        const harness = new AgentHarness({
            llm: llm,
            tools: effectiveTools,
            deferredTools,
            mcpClientManager,
            operations: localOperations,
            modelOptions: {
                model: initialModel,
                thinkingLevel: config.thinkingLevel || 'fast',
            },
            sessionRepository,
            sessionId,
            runtime: 'cli',
            workspaceDir,
            thinkingLevel: config.thinkingLevel || 'fast',
            steeringMode: config.steeringMode || 'all',
            followUpMode: config.followUpMode || 'all',
            lean: true,
        })

        const agent = harness.getAgent()
        await agent.loadContext()

        const isPrint = Boolean(parsedArgs.print)
        const isRpc = parsedArgs.rpc || (!isPrint && !parsedArgs.json)

        const rawPrompt = parsedArgs.prompt || ''
        const effectivePrompt = isAskMode ? getAskPrompt(rawPrompt) : rawPrompt

        const result = await runHeadlessTask(effectivePrompt, {
            agent,
            nonInteractive: parsedArgs.yes || isPrint,
            json: parsedArgs.json,
            rpc: isRpc,
            print: isPrint,
            readOnly: isAskMode,
        })
        await mcpClientManager.disconnectAll().catch(() => {
            // Intentionally swallowed: ignore disconnect errors on headless exit
        })
        process.exit(result.success ? 0 : 1)
    }

    // Path 5: Full Interactive TUI Session (Differential 2D Screen Buffer Engine)
    const [
        { AgentHarness, runAgentLoop },
        { openaiProvider, getModelContextWindow },
        toolsModule,
        { DifferentialApp },
        { FileSessionRepository },
        { getProviderConfig, loadConfig, saveConfig, getAuthStatus, getConfiguredProviders },
        { suppressConsole },
        { localOperations, setActiveScopeDir },
        { instantiateProvider },
        { ensureValidModelForProvider, getModelLabel, getProviderModels },
        { useCliStore },
        { convertAgentMessagesToDifferentialMessages },
    ] = await Promise.all([
        import('@december/agent'),
        import('@december/providers'),
        import('@december/tools'),
        import('@december/tui'),
        import('./file-session-repository'),
        import('./config'),
        import('./headless-runner'),
        import('./local-operations'),
        import('./utils/provider-factory'),
        import('./utils/models'),
        import('./store'),
        import('./utils/message-converter'),
    ])

    if (parsedArgs.scope) {
        setActiveScopeDir(parsedArgs.scope)
    }

    // Suppress noisy sdk console logs that corrupt the tui layout
    suppressConsole()

    const providerConfig = await getProviderConfig()
    const authStatus = await getAuthStatus()

    // If not authenticated, pass a dummy provider so the agent can boot.
    // The TUI will intercept prompts and force them to /login
    let llm: any
    if (providerConfig) {
        llm = instantiateProvider(providerConfig.provider, providerConfig.apiKey, {
            authMethod: providerConfig.authMethod,
            subscription: providerConfig.subscription,
            headers: providerConfig.headers,
            baseURL: providerConfig.baseURL,
        })
    } else {
        llm = openaiProvider(undefined, 'dummy-key')
    }

    const isAuthenticated = !!providerConfig
    const sessionRepository = new FileSessionRepository()
    let allSessions: any[] = []
    let targetSessionId = parsedArgs.sessionId
    const isExplicitResumeCmd = parsedArgs.command === 'resume'
    const isResumeFlag = Boolean(parsedArgs.resume)
    let shouldOpenSessionMenuOnBoot = false

    if (isExplicitResumeCmd || isResumeFlag) {
        allSessions = await sessionRepository.listSessions()
        if (!targetSessionId && parsedArgs.positionals[1]) {
            targetSessionId = parsedArgs.positionals[1]
        }
        if (!targetSessionId) {
            if (isResumeFlag && !isExplicitResumeCmd) {
                if (allSessions.length > 0) {
                    targetSessionId = allSessions[0].id
                }
            } else if (isExplicitResumeCmd) {
                shouldOpenSessionMenuOnBoot = true
                if (allSessions.length > 0) {
                    targetSessionId = allSessions[0].id
                }
            }
        }
    } else {
        // Hydrate session list in background to achieve sub-50ms cold boot
        sessionRepository
            .listSessions()
            .then((sessions) => {
                if (differentialApp) {
                    differentialApp.state.sessions = sessions.map((s) => ({
                        id: s.id,
                        preview: s.preview || s.id,
                        updatedAt: s.updatedAt || Date.now(),
                        messageCount: s.messageCount,
                    }))
                }
            })
            .catch(() => {
                // Intentionally swallowed: background session list load failure
            })
    }
    const sessionId = targetSessionId || `session-${Date.now()}`
    const config = await loadConfig()
    const activeProvider = providerConfig?.provider || config.activeProvider || 'gemini'
    const initialModel =
        providerConfig?.authMethod === 'december'
            ? 'december-auto'
            : parsedArgs.model ||
              providerConfig?.model ||
              ensureValidModelForProvider(activeProvider, config.activeModel)

    useCliStore.getState().setActiveModel(initialModel)
    useCliStore.getState().setSelectedProvider(activeProvider)
    useCliStore.getState().setIsAuthenticated(isAuthenticated)
    useCliStore.getState().setHasDecember(authStatus.hasDecember)
    if (config.decemberToken && config.email) {
        useCliStore.getState().setDecemberEmail(config.email)
    }
    if (providerConfig?.authMethod) {
        useCliStore.getState().setAuthMethod(providerConfig.authMethod)
    }
    if (!isAuthenticated) {
        if (!config.email && !config.decemberToken) {
            useCliStore.getState().setAuthMode('none')
        } else {
            useCliStore.getState().setAuthMode('menu')
        }
    }

    const targetWorkspaceDir = parsedArgs.scope
        ? path.resolve(process.cwd(), parsedArgs.scope)
        : process.cwd()
    const mcpClientManager = new toolsModule.McpClientManager({ workspaceDir: targetWorkspaceDir })
    toolsModule
        .loadMcpConfig({ workspaceDir: targetWorkspaceDir })
        .then(async (mcpConfigs) => {
            const mcpCount = Object.keys(mcpConfigs).length
            if (mcpCount > 0) {
                await mcpClientManager.connectAll(mcpConfigs).catch(() => {
                    // Intentionally swallowed: ignore MCP connection errors on startup
                })
                if (differentialApp) {
                    differentialApp.state.mcpServersCount = mcpCount
                    differentialApp.render()
                }
            }
        })
        .catch(() => {
            // Intentionally swallowed: ignore MCP config loading errors
        })

    const harness = new AgentHarness({
        llm: llm,
        tools: toolsModule.CORE_TOOLS,
        deferredTools: toolsModule.DEFERRED_TOOLS,
        mcpClientManager,
        operations: localOperations,
        modelOptions: {
            model: initialModel,
            thinkingLevel: config.thinkingLevel || 'fast',
        },
        sessionRepository,
        sessionId,
        runtime: 'cli',
        workspaceDir: targetWorkspaceDir,
        thinkingLevel: config.thinkingLevel || 'fast',
        steeringMode: config.steeringMode || 'all',
        followUpMode: config.followUpMode || 'all',
    })

    const agent = harness.getAgent()

    const userEmail = config.decemberToken
        ? config.email
        : providerConfig?.subscription?.email || config.email || undefined

    let differentialApp: DifferentialApp

    let activePlanGoal: string | null = null
    let activePlanText: string | null = null

    const runAgentExecution = async (promptText: string): Promise<string> => {
        let streamedResponse = ''
        differentialApp.state.isStreaming = true
        differentialApp.startSpinner()
        differentialApp.render()

        try {
            const { getProviderConfig, loadConfig } = await import('./config')
            const cfg = await loadConfig()
            const providerCfg = await getProviderConfig()
            const activeProv = providerCfg?.provider || cfg.activeProvider || 'gemini'
            const activeMod = agent.modelOptions?.model || cfg.activeModel
            const { isValidModelForProvider } = await import('./utils/models')
            const { getCleanProviderDisplayName } = await import('@december/shared')
            if (activeMod && !isValidModelForProvider(activeProv, activeMod)) {
                const displayName = getCleanProviderDisplayName(activeProv, activeMod)
                const { getDefaultModelForProvider } = await import('@december/providers')
                const fallback = getDefaultModelForProvider(activeProv)
                const hasFallback = Boolean(
                    fallback && fallback.toLowerCase() !== activeMod.toLowerCase()
                )
                const hintText = hasFallback
                    ? `Press [Enter] to switch to '${fallback}' & retry · [m] /model · [Esc] dismiss`
                    : `Please select an available model using \`/model\` or switch providers using \`/switch\`.`
                const errorMsg =
                    `Model '${activeMod}' is not available or not supported on ${displayName}.\n` +
                    `${hintText}`
                differentialApp.clearStatusMessage()
                differentialApp.state.messages.push({
                    role: 'error',
                    content: errorMsg,
                    hint: hintText,
                })
                differentialApp.state.scrollOffset = undefined
                differentialApp.showToast(
                    `Model '${activeMod}' not supported on ${displayName}`,
                    'error'
                )
                if (hasFallback) {
                    differentialApp.setPendingModelFallback({
                        provider: activeProv,
                        failedModel: activeMod,
                        fallbackModel: fallback,
                        prompt: promptText,
                    })
                }
                differentialApp.render()
                return ''
            }

            let executionPrompt = promptText

            if (executionPrompt.includes('@') && !executionPrompt.includes('<context_file')) {
                try {
                    const { resolveContextMentions } = await import('@december/shared')
                    const resolved = await resolveContextMentions(executionPrompt, process.cwd())
                    executionPrompt = resolved.expandedPrompt
                } catch (mentionErr: any) {
                    // Intentionally swallowed: keep executionPrompt on resolution error, but toast warning
                    differentialApp.showToast(
                        `Context mention warning: ${mentionErr?.message || 'could not resolve file'}`,
                        'info'
                    )
                }
            }

            const { getToolSummary } = await import('./utils/formatters')
            const stream = runAgentLoop(agent, executionPrompt)
            for await (const event of stream) {
                if (event.type === 'StreamChunk') {
                    differentialApp.clearStatusMessage()
                    differentialApp.appendStreamDelta(event.content)
                    streamedResponse += event.content
                } else if (event.type === 'ThinkingChunk') {
                    differentialApp.appendThinkingChunk(event.content)
                } else if (event.type === 'AgentStatus') {
                    if (event.message && event.message.trim().length > 0) {
                        differentialApp.setStatusMessage(event.message.trim())
                    } else {
                        differentialApp.clearStatusMessage()
                    }
                } else if (event.type === 'AgentError') {
                    differentialApp.clearStatusMessage()
                    differentialApp.stopSpinner()
                    differentialApp.state.isStreaming = false
                    differentialApp.state.messages.push({
                        role: 'error',
                        content: event.error,
                        cause: event.cause,
                        hint: event.hint,
                    })
                    if (event.code === 'MODEL_UNAVAILABLE' && event.fallbackModel) {
                        differentialApp.setPendingModelFallback({
                            provider: event.provider || activeProv,
                            failedModel: event.model || activeMod || 'unknown',
                            fallbackModel: event.fallbackModel,
                            prompt: promptText,
                        })
                    }
                    differentialApp.state.scrollOffset = undefined
                    differentialApp.state.isReadingMode = false
                    differentialApp.render()
                } else if (event.type === 'AgentInterrupt') {
                    differentialApp.clearStatusMessage()
                    if (differentialApp.state.isStreaming) {
                        differentialApp.appendStreamDelta(
                            '\n\nInterrupted · What should December do instead?'
                        )
                    }
                } else if (event.type === 'ToolCallStart') {
                    differentialApp.flushStream()
                    differentialApp.clearStatusMessage()
                    const inputStr =
                        typeof event.toolCall.input === 'string'
                            ? event.toolCall.input
                            : JSON.stringify(event.toolCall.input || {})
                    differentialApp.appendToolCall({
                        id: event.toolCall.id,
                        name: event.toolCall.name,
                        input: event.toolCall.input,
                        command: getToolSummary(event.toolCall.name, inputStr),
                    })
                } else if (event.type === 'ToolExecutionUpdate') {
                    differentialApp.updateToolExecution(event.toolCallId, event.chunk)
                } else if (event.type === 'ToolCallResult') {
                    differentialApp.updateToolResult(event.result.toolCallId, {
                        output: event.result.error || event.result.result,
                        isError: Boolean(event.result.error),
                    })
                } else if (event.type === 'AgentUsage') {
                    differentialApp.state.contextTokens =
                        event.promptTokens + event.completionTokens
                    differentialApp.render()
                } else if (event.type === 'ContextCompacted') {
                    differentialApp.showToast(
                        'Context memory compacted to optimize latency',
                        'info'
                    )
                }
            }
        } catch (err: any) {
            differentialApp.clearStatusMessage()
            differentialApp.state.messages.push({
                role: 'error',
                content: err.message || 'Execution error',
            })
            differentialApp.state.scrollOffset = undefined
            differentialApp.render()
        } finally {
            differentialApp.finishStream()
            differentialApp.refreshWorkspaceFiles().catch(() => {
                // Intentionally swallowed: refresh workspace files after agent turn
            })
            setTimeout(() => {
                differentialApp.drainPromptQueue()
            }, 0)
        }

        return streamedResponse
    }

    const handlePlanApprovalCycle = async (goal: string, planText: string) => {
        const decision = await differentialApp.requestPlanApproval({
            summary: goal,
            fullPlan: planText,
        })

        if (decision === 'approve') {
            differentialApp.showToast('Plan approved. Launching autonomous execution...', 'success')
            const { getPlanExecutionPrompt } = await import('./constants/prompts')
            const executionPrompt = getPlanExecutionPrompt(goal, planText)
            activePlanGoal = null
            activePlanText = null
            await runAgentExecution(executionPrompt)
        } else if (decision === 'refine') {
            differentialApp.setInput('/plan refine: ')
            differentialApp.showToast('Enter feedback to refine the plan', 'info')
        } else if (decision === 'view') {
            // Full plan opened in scrollable file viewer
        } else if (decision === 'reject') {
            activePlanGoal = null
            activePlanText = null
            differentialApp.showToast('Plan discarded.', 'info')
        }
    }

    const buildSettingsFromConfig = (cfg: DecemberConfig, prov?: string, mod?: string) => {
        // Same fallbacks as session startup: default provider 'gemini', then that provider's default model
        const settingsProvider = prov || cfg.activeProvider || 'gemini'
        return [
            {
                id: 'provider',
                title: 'Active Provider',
                value: settingsProvider,
            },
            {
                id: 'model',
                title: 'Active Model',
                value: getModelLabel(
                    mod || ensureValidModelForProvider(settingsProvider, cfg.activeModel)
                ),
            },
            {
                id: 'tool_permission',
                title: 'Tool Permission',
                value: cfg.toolPermission || 'always-proceed',
            },
            {
                id: 'pathguard',
                title: 'PathGuard Protection',
                value: cfg.pathGuard === false ? 'off' : 'on',
            },
            {
                id: 'non_workspace',
                title: 'Non-Workspace Access',
                value: cfg.nonWorkspaceAccess ? 'on' : 'off',
            },
            { id: 'thinking_level', title: 'Thinking Level', value: cfg.thinkingLevel || 'fast' },
            { id: 'steering_mode', title: 'Steering Mode', value: cfg.steeringMode || 'all' },
            { id: 'follow_up_mode', title: 'Follow-Up Mode', value: cfg.followUpMode || 'all' },
            {
                id: 'browser_visible',
                title: 'Browser Visible',
                value: cfg.browserVisible ? 'on' : 'off',
            },
        ]
    }

    const { taskManager } = await import('./task-manager')
    type BackgroundTask = import('./task-manager').BackgroundTask

    const mapBackgroundTasksToTaskItems = (tasks: BackgroundTask[]): TaskItem[] => {
        return tasks.map((t) => {
            let duration: string | undefined
            const end = t.completedAt ? t.completedAt.getTime() : Date.now()
            const diffMs = Math.max(0, end - t.createdAt.getTime())
            const secs = Math.floor(diffMs / 1000)
            if (secs < 60) duration = `${secs}s`
            else duration = `${Math.floor(secs / 60)}m ${secs % 60}s`

            return {
                id: t.id,
                command: t.command,
                status:
                    t.status === 'running'
                        ? 'running'
                        : t.status === 'completed'
                          ? 'completed'
                          : 'failed',
                duration,
                exitCode: t.exitCode ?? undefined,
                output: t.output,
            }
        })
    }

    differentialApp = new DifferentialApp({
        settings: buildSettingsFromConfig(config, activeProvider, initialModel),
        tasks: mapBackgroundTasksToTaskItems(taskManager.getTasks()),
        onKillTask: (taskId: string) => {
            taskManager.killTask(taskId)
        },
        cliVersion: pkg.version,
        userEmail,
        decemberEmail: config.decemberToken ? config.email : undefined,
        hasDecember: authStatus.hasDecember,
        isAuthenticated,
        authRequiredNotice: AUTH_REQUIRED_NOTICE,
        modelLabel: getModelLabel(initialModel),
        activeModel: initialModel,
        authMethod: providerConfig?.authMethod,
        selectedProvider: activeProvider,
        models: getProviderModels(activeProvider),
        getProviderModels: (provider) => getProviderModels(provider),
        contextTokens: 0,
        maxContextTokens: getModelContextWindow(initialModel),
        sessionId,
        thinkingLevel: config.thinkingLevel || 'fast',
        onAbort: () => {
            if (agent?.activeAbortController) {
                agent.activeAbortController.abort()
            }
        },
        sessions: allSessions.map((s) => ({
            id: s.id,
            preview: s.preview || s.id,
            updatedAt: s.updatedAt || Date.now(),
            messageCount: s.messageCount,
        })),
        sessionRepository,
        onSessionSelect: async (selectedSessionId: string) => {
            try {
                await agent.loadContext(selectedSessionId)
                differentialApp.state.messages = convertAgentMessagesToDifferentialMessages(
                    agent.messages || []
                )
                differentialApp.state.sessionId = selectedSessionId
                differentialApp.state.scrollOffset = undefined
                differentialApp.render()
            } catch (err: any) {
                differentialApp.showToast(`Failed to resume session: ${err.message}`, 'error')
            }
        },
        onSessionDelete: async (deletedSessionId: string) => {
            try {
                await sessionRepository.deleteSession(deletedSessionId)
            } catch {
                // Intentionally swallowed: ignore session delete failure
            }
        },
        onSessionRename: async (oldId: string, newId: string) => {
            try {
                await sessionRepository.renameSession(oldId, newId)
            } catch {
                // Intentionally swallowed: ignore session rename failure
            }
        },
        onEffortSelect: async (level) => {
            if (agent) {
                agent.thinkingLevel = level
                if (agent.modelOptions) {
                    agent.modelOptions.thinkingLevel = level
                }
            }
            if (harness) {
                harness.updateThinkingLevel(level)
            }
            try {
                const cfg = await loadConfig()
                await saveConfig({ ...cfg, thinkingLevel: level })
            } catch {
                // Intentionally swallowed: ignore thinking level config save error
            }
        },
        onSettingChange: async (settingId: string, newValue: string) => {
            try {
                const cfg = await loadConfig()
                if (settingId === 'pathguard') {
                    cfg.pathGuard = newValue === 'on'
                } else if (settingId === 'non_workspace') {
                    cfg.nonWorkspaceAccess = newValue === 'on'
                } else if (settingId === 'tool_permission') {
                    cfg.toolPermission = newValue as 'always-proceed' | 'always-ask'
                } else if (settingId === 'thinking_level') {
                    cfg.thinkingLevel = newValue as any
                    if (agent) {
                        agent.thinkingLevel = newValue as any
                        if (agent.modelOptions) {
                            agent.modelOptions.thinkingLevel = newValue
                        }
                    }
                    if (harness) {
                        harness.updateThinkingLevel(newValue)
                    }
                } else if (settingId === 'steering_mode') {
                    cfg.steeringMode = newValue as 'all' | 'one-at-a-time'
                    if (agent && agent.steeringQueue) {
                        agent.steeringQueue.mode = newValue as 'all' | 'one-at-a-time'
                    }
                } else if (settingId === 'follow_up_mode') {
                    cfg.followUpMode = newValue as 'all' | 'one-at-a-time'
                    if (agent && agent.followUpQueue) {
                        agent.followUpQueue.mode = newValue as 'all' | 'one-at-a-time'
                    }
                } else if (settingId === 'browser_visible') {
                    cfg.browserVisible = newValue === 'on'
                }
                await saveConfig(cfg)
            } catch {
                // Intentionally swallowed: ignore setting config save error
            }
        },
        onModelSelect: async (selected) => {
            try {
                const cfg = await loadConfig()
                const { getProviderConfig } = await import('./config')
                const providerConfig = await getProviderConfig()
                const activeProv = providerConfig?.provider || cfg.activeProvider || 'gemini'
                const { isValidModelForProvider } = await import('./utils/models')
                if (!isValidModelForProvider(activeProv, selected.value)) {
                    const { getCleanProviderDisplayName } = await import('@december/shared')
                    const displayName = getCleanProviderDisplayName(activeProv, selected.value)
                    differentialApp.showToast(
                        `Model '${selected.label}' is not supported on ${displayName}. Use /switch to change provider.`,
                        'error'
                    )
                    return
                }
                cfg.activeModel = selected.value
                await saveConfig(cfg)
                if (agent && agent.modelOptions) {
                    agent.modelOptions.model = selected.value
                }
                if (providerConfig && agent) {
                    const { instantiateProvider } = await import('./utils/provider-factory')
                    const llm = instantiateProvider(
                        providerConfig.provider,
                        providerConfig.apiKey,
                        {
                            authMethod: providerConfig.authMethod,
                            subscription: providerConfig.subscription,
                            headers: providerConfig.headers,
                            baseURL: providerConfig.baseURL,
                        }
                    )
                    agent.setLLM(llm)
                }
                differentialApp.state.activeModel = selected.value
                differentialApp.state.modelLabel = selected.label
                differentialApp.state.maxContextTokens = getModelContextWindow(selected.value)
                differentialApp.showToast(`Switched model to ${selected.label}`, 'success')
                differentialApp.render()
            } catch (err: any) {
                differentialApp.showToast(
                    `Failed to select model: ${err?.message || 'Error'}`,
                    'error'
                )
            }
        },
        onModelFallback: async (fallbackModel, failedModel, originalPrompt) => {
            try {
                const cfg = await loadConfig()
                const { getProviderConfig } = await import('./config')
                const providerConfig = await getProviderConfig()
                const activeProv = providerConfig?.provider || cfg.activeProvider || 'gemini'
                const { markModelUnavailable, getModelLabel } = await import('./utils/models')
                markModelUnavailable(activeProv, failedModel)

                cfg.activeModel = fallbackModel
                await saveConfig(cfg)
                if (agent && agent.modelOptions) {
                    agent.modelOptions.model = fallbackModel
                }
                if (providerConfig && agent) {
                    const { instantiateProvider } = await import('./utils/provider-factory')
                    const llm = instantiateProvider(
                        providerConfig.provider,
                        providerConfig.apiKey,
                        {
                            authMethod: providerConfig.authMethod,
                            subscription: providerConfig.subscription,
                            headers: providerConfig.headers,
                            baseURL: providerConfig.baseURL,
                        }
                    )
                    agent.setLLM(llm)
                }
                const fallbackLabel = getModelLabel(fallbackModel)
                differentialApp.state.activeModel = fallbackModel
                differentialApp.state.modelLabel = fallbackLabel
                differentialApp.state.maxContextTokens = getModelContextWindow(fallbackModel)
                differentialApp.refreshModelsForProvider(activeProv)
                differentialApp.showToast(
                    `Switched model to ${fallbackLabel} and retrying...`,
                    'info'
                )
                differentialApp.render()

                if (originalPrompt) {
                    await runAgentExecution(originalPrompt)
                }
            } catch (err: any) {
                differentialApp.showToast(
                    `Failed to switch model: ${err?.message || 'Error'}`,
                    'error'
                )
            }
        },
        onLogin: async (onCode, signal) => {
            const { loginViaDeviceCode } = await import('./auth')
            const result = await loginViaDeviceCode(undefined, onCode, signal)
            try {
                const cfg = await loadConfig()
                await saveConfig({
                    ...cfg,
                    decemberToken: result.token,
                    email: result.email || undefined,
                    authPriority: 'december',
                    activeModel: 'december-auto',
                })
                differentialApp.state.selectedProvider = 'december'
                differentialApp.state.authMethod = 'december'
                differentialApp.state.activeModel = 'december-auto'
                differentialApp.state.modelLabel = getModelLabel('december-auto')
                differentialApp.state.isAuthenticated = true
                differentialApp.state.switchItems = getConfiguredProviders(await loadConfig())
                differentialApp.refreshModelsForProvider('december')
                if (agent) {
                    const { instantiateProvider } = await import('./utils/provider-factory')
                    const llm = instantiateProvider('december_proxy', result.token, {
                        authMethod: 'december',
                    })
                    agent.setLLM(llm)
                    if (agent.modelOptions) {
                        agent.modelOptions.model = 'december-auto'
                    }
                }
                differentialApp.render()
            } catch (err: any) {
                differentialApp.showToast(`Login setup failed: ${err?.message || 'Error'}`, 'error')
            }
            return result
        },
        onSubscriptionLogin: async (provider, onCode) => {
            const { loginSubscription } = await import('./auth/subscriptions/subscription-manager')
            const bundle = await loginSubscription(provider, (code, uri) => {
                if (onCode) {
                    onCode(code, uri)
                }
            })
            try {
                const { getDefaultModelForProvider, fetchLiveProviderModels } =
                    await import('./utils/models')
                const targetModel = getDefaultModelForProvider(bundle.provider || provider)
                const cfg = await loadConfig()
                cfg.subscriptions = cfg.subscriptions || {}
                cfg.subscriptions[bundle.provider || provider] = bundle
                const targetProvider = bundle.provider || provider
                cfg.activeProvider = targetProvider
                cfg.activeModel = targetModel
                cfg.authPriority = 'subscription'
                await saveConfig(cfg)
                differentialApp.state.selectedProvider = targetProvider
                differentialApp.state.authMethod = 'subscription'
                differentialApp.state.activeModel = targetModel
                differentialApp.state.modelLabel = getModelLabel(targetModel)
                differentialApp.state.switchItems = getConfiguredProviders(cfg)
                differentialApp.refreshModelsForProvider(targetProvider)
                if (agent) {
                    const { instantiateProvider } = await import('./utils/provider-factory')
                    const llm = instantiateProvider(bundle.provider, bundle.accessToken, {
                        authMethod: 'subscription',
                        subscription: bundle,
                        baseURL: bundle.endpoint,
                    })
                    agent.setLLM(llm)
                    if (agent.modelOptions) {
                        agent.modelOptions.model = targetModel
                    }
                }
                fetchLiveProviderModels(
                    bundle.provider || provider,
                    bundle.accessToken,
                    bundle.endpoint
                )
                    .then((liveModels) => {
                        if (liveModels && liveModels.length > 0) {
                            differentialApp.refreshModelsForProvider(targetProvider)
                            differentialApp.render()
                        }
                    })
                    .catch(() => {
                        // Intentionally swallowed: background live model fetch failure
                    })
            } catch (err: any) {
                differentialApp.showToast(
                    `Subscription login failed: ${err?.message || 'Error'}`,
                    'error'
                )
            }
            return bundle
        },
        onSaveApiKey: async (provider: string, apiKey: string) => {
            try {
                const cfg = await loadConfig()
                cfg.providers = cfg.providers || {}
                cfg.providers[provider] = apiKey
                cfg.activeProvider = provider
                cfg.authPriority = 'byok'
                const { getDefaultModelForProvider, fetchLiveProviderModels } =
                    await import('./utils/models')
                const targetModel = getDefaultModelForProvider(provider)
                cfg.activeModel = targetModel
                await saveConfig(cfg)
                differentialApp.state.selectedProvider = provider
                differentialApp.state.authMethod = 'byok'
                differentialApp.state.activeModel = targetModel
                differentialApp.state.modelLabel = getModelLabel(targetModel)
                differentialApp.state.switchItems = getConfiguredProviders(cfg)
                differentialApp.state.isAuthenticated = true
                differentialApp.refreshModelsForProvider(provider)
                if (agent) {
                    const { instantiateProvider } = await import('./utils/provider-factory')
                    const llm = instantiateProvider(provider, apiKey, {
                        authMethod: 'byok',
                    })
                    agent.setLLM(llm)
                    if (agent.modelOptions) {
                        agent.modelOptions.model = targetModel
                    }
                }
                differentialApp.render()
                fetchLiveProviderModels(provider, apiKey)
                    .then((liveModels) => {
                        if (liveModels && liveModels.length > 0) {
                            differentialApp.refreshModelsForProvider(provider)
                            differentialApp.render()
                        }
                    })
                    .catch(() => {
                        // Intentionally swallowed: background live model fetch failure
                    })
            } catch (err: any) {
                differentialApp.showToast(
                    `Failed to save API key: ${err?.message || 'Error'}`,
                    'error'
                )
            }
        },
        switchItems: getConfiguredProviders(config),
        onSwitchSelect: async (value: string) => {
            const { resolveSwitchTarget, applyProviderSwitch, getProviderConfig } =
                await import('./config')
            const cfg = await loadConfig()
            const target = resolveSwitchTarget(cfg, value)
            if (!target) return
            const { config: updatedConfig, model } = applyProviderSwitch(cfg, target)
            await saveConfig(updatedConfig)
            const providerConfig = await getProviderConfig()
            if (providerConfig && agent) {
                const { instantiateProvider } = await import('./utils/provider-factory')
                const llm = instantiateProvider(providerConfig.provider, providerConfig.apiKey, {
                    authMethod: providerConfig.authMethod,
                    subscription: providerConfig.subscription,
                    headers: providerConfig.headers,
                    baseURL: providerConfig.baseURL,
                })
                agent.setLLM(llm)
                if (agent.modelOptions) {
                    agent.modelOptions.model = model
                }
            }
            differentialApp.state.activeModel = model
            differentialApp.state.modelLabel = getModelLabel(model)
            differentialApp.state.selectedProvider = target.provider
            differentialApp.state.authMethod = target.authPriority
            differentialApp.state.switchItems = getConfiguredProviders(updatedConfig)
            differentialApp.refreshModelsForProvider(target.provider)
            differentialApp.render()
        },
        onDeleteProvider: async (value: string) => {
            const cfg = await loadConfig()
            if (value === 'decemberToken') {
                cfg.decemberToken = undefined
                cfg.email = undefined
            } else if (value.startsWith('subscription:')) {
                const provider = value.split(':')[1]
                if (provider && cfg.subscriptions) {
                    delete cfg.subscriptions[provider]
                }
            } else if (value.startsWith('provider:') || value.startsWith('byok:')) {
                const provider = value.replace(/^(provider|byok):/, '')
                if (provider && cfg.providers) {
                    delete cfg.providers[provider]
                }
            }
            await saveConfig(cfg)
            differentialApp.state.switchItems = getConfiguredProviders(cfg)
            differentialApp.render()
        },
        onCodeSearch: async (query: string) => {
            try {
                const raw = await localOperations.search.grep('.', query)
                const { parseGrepOutput } = await import('@december/tui')
                return parseGrepOutput(raw, process.cwd())
            } catch {
                // Intentionally swallowed: return empty matches on grep failure
                return []
            }
        },
        onSideQuestion: async (question, handlers) => {
            try {
                const { runSideQuestion } = await import('@december/agent')
                await runSideQuestion(agent, question, {
                    signal: handlers.signal,
                    onChunk: handlers.onChunk,
                })
                handlers.onComplete()
            } catch (err: any) {
                handlers.onError(err)
            }
        },
        onExecuteDirectCommand: async (cmd: string) => {
            const toolCallId = `shell_${Date.now()}`
            differentialApp.appendToolCall({
                id: toolCallId,
                name: 'execute_command',
                command: cmd,
            })
            differentialApp.state.isStreaming = true
            differentialApp.render()

            try {
                const { startDirectCommand } = await import('./utils/direct-shell')
                const { promise } = startDirectCommand(cmd, {
                    timeoutMs: 30_000,
                    onData: (chunk) => {
                        differentialApp.updateToolExecution(toolCallId, chunk)
                    },
                    onBackground: (taskId) => {
                        differentialApp.updateToolExecution(
                            toolCallId,
                            `\n[Moved to background task: ${taskId}. Use /tasks to inspect.]\n`
                        )
                        differentialApp.updateToolResult(toolCallId, {
                            output: `[Moved to background task: ${taskId}. Use /tasks to inspect.]`,
                            isError: false,
                        })
                        differentialApp.showToast(
                            `Command moved to background (${taskId}). Use /tasks to view logs.`,
                            'info'
                        )
                    },
                })
                const result = await promise
                const finalOutput = result.isBackground
                    ? (result.output ? result.output.trim() + '\n' : '') +
                      `[Moved to background task: ${result.taskId}. Use /tasks to inspect.]`
                    : result.output
                differentialApp.updateToolResult(toolCallId, {
                    output: finalOutput,
                    isError: result.exitCode !== 0,
                })
                if (agent && agent.messages) {
                    agent.messages.push({
                        role: 'user',
                        content: `!${cmd}`,
                    })
                    agent.messages.push({
                        role: 'assistant',
                        content: `[Direct Shell Output: ${cmd}]\n${result.output}`,
                    })
                }
            } catch (err: any) {
                differentialApp.updateToolResult(toolCallId, {
                    output: err.message || 'Execution failed',
                    isError: true,
                })
            } finally {
                differentialApp.state.isStreaming = false
                differentialApp.render()
                setTimeout(() => {
                    differentialApp.drainPromptQueue()
                }, 0)
            }
        },
        onUndo: async () => {
            try {
                if (agent) {
                    const result = await agent.rollbackLastTurn()
                    differentialApp.state.messages = convertAgentMessagesToDifferentialMessages(
                        agent.messages || []
                    )
                    const count =
                        (result.restoredFiles?.length || 0) + (result.deletedFiles?.length || 0)
                    differentialApp.showToast(
                        `Undid Turn ${result.targetTurn}. (${count} file${count === 1 ? '' : 's'} affected)`,
                        'success'
                    )
                    differentialApp.render()
                    return
                }
                const { getSnapshotManager } = await import('@december/tools')
                const manager = getSnapshotManager(process.cwd())
                await manager.init()
                const snapshots = manager.getSnapshots()
                if (snapshots.length === 0) {
                    differentialApp.showToast('No turn snapshots recorded in this session.', 'info')
                    return
                }
                differentialApp.showToast('Reverting last agent turn...', 'info')
                const result = await manager.rollbackLastTurn()
                const count =
                    (result.restoredFiles?.length || 0) + (result.deletedFiles?.length || 0)
                differentialApp.showToast(
                    `Undid Turn ${result.targetTurn}. (${count} file${count === 1 ? '' : 's'} affected)`,
                    'success'
                )
            } catch (e: any) {
                differentialApp.showToast(`Failed to undo: ${e.message}`, 'error')
            }
        },
        onRewindTurn: async (turnIndex: number) => {
            try {
                if (agent) {
                    const result = await agent.rollbackToTurn(turnIndex)
                    differentialApp.state.messages = convertAgentMessagesToDifferentialMessages(
                        agent.messages || []
                    )
                    const count =
                        (result.restoredFiles?.length || 0) + (result.deletedFiles?.length || 0)
                    differentialApp.showToast(
                        `Rewound to Turn ${turnIndex}. (${count} file${count === 1 ? '' : 's'} affected)`,
                        'success'
                    )
                    differentialApp.render()
                    return
                }
                const { getSnapshotManager } = await import('@december/tools')
                const manager = getSnapshotManager(process.cwd())
                await manager.init()
                const result = await manager.rollbackToTurn(turnIndex)
                const count =
                    (result.restoredFiles?.length || 0) + (result.deletedFiles?.length || 0)
                differentialApp.showToast(
                    `Rewound to Turn ${turnIndex}. (${count} file${count === 1 ? '' : 's'} affected)`,
                    'success'
                )
                differentialApp.render()
            } catch (e: any) {
                differentialApp.showToast(`Failed to rewind: ${e.message}`, 'error')
            }
        },
        onLoadRewindTurns: async () => {
            try {
                const { getSnapshotManager } = await import('@december/tools')
                const manager = getSnapshotManager(process.cwd())
                await manager.init()
                const snapshots = manager.getSnapshots()
                return [...snapshots]
                    .sort((a, b) => b.turnIndex - a.turnIndex)
                    .map((s) => ({
                        turnIndex: s.turnIndex,
                        commitHash: s.commitHash,
                        prompt: s.prompt,
                        timestamp: s.timestamp,
                        touchedFiles: s.touchedFiles,
                    }))
            } catch {
                return []
            }
        },
        onClearContext: async () => {
            if (agent) {
                await agent.clearContext()
                differentialApp.state.messages = []
                differentialApp.state.contextTokens = 0
                differentialApp.render()
            }
        },
        onNewContext: async () => {
            if (agent) {
                await agent.newContext()
                differentialApp.state.messages = []
                differentialApp.state.contextTokens = 0
                differentialApp.state.sessionId = agent.sessionId
                differentialApp.render()
                return agent.sessionId
            }
        },
        onForkContext: async (newSessionId?: string) => {
            if (agent) {
                const newId = await agent.forkContext(newSessionId)
                differentialApp.state.sessionId = newId
                differentialApp.render()
                return newId
            }
        },
        onSubmit: async (promptText: string) => {
            if (differentialApp.state.isStreaming) {
                differentialApp.state.promptQueue.push(promptText)
                differentialApp.showToast(
                    `Prompt queued (#${differentialApp.state.promptQueue.length}). Will run after turn finishes.`,
                    'info'
                )
                differentialApp.render()
                return
            }

            if (!differentialApp.state.isAuthenticated) {
                differentialApp.state.messages.push({
                    role: 'assistant',
                    content: AUTH_REQUIRED_NOTICE,
                })
                differentialApp.state.isStreaming = false
                differentialApp.render()
                return
            }

            const isPlanRefine = promptText.startsWith('/plan refine')
            const isPlanApprove =
                promptText === '/plan approve' || promptText.startsWith('/plan approve')
            const isPlanReject =
                promptText === '/plan reject' || promptText.startsWith('/plan reject')
            const isPlanStart =
                (promptText.startsWith('/plan ') || promptText === '/plan') &&
                !isPlanRefine &&
                !isPlanApprove &&
                !isPlanReject

            if (isPlanReject) {
                activePlanGoal = null
                activePlanText = null
                differentialApp.showToast('Plan discarded.', 'info')
                return
            }

            if (isPlanApprove) {
                if (!activePlanGoal || !activePlanText) {
                    differentialApp.showToast('No active plan to approve.', 'info')
                    return
                }
                differentialApp.showToast(
                    'Plan approved. Launching autonomous execution...',
                    'success'
                )
                const { getPlanExecutionPrompt } = await import('./constants/prompts')
                const executionPrompt = getPlanExecutionPrompt(activePlanGoal, activePlanText)
                activePlanGoal = null
                activePlanText = null
                await runAgentExecution(executionPrompt)
                return
            }

            if (isPlanStart) {
                const goal = promptText.replace(/^\/plan\s*/, '').trim()
                if (goal) {
                    activePlanGoal = goal
                    const { getPlanPrompt } = await import('./constants/prompts')
                    const planPrompt = getPlanPrompt(goal, [])
                    const planResult = await runAgentExecution(planPrompt)
                    activePlanText = planResult
                    await handlePlanApprovalCycle(goal, planResult)
                }
                return
            }

            if (isPlanRefine) {
                const feedback = promptText.replace(/^\/plan\s+refine:?\s*/i, '').trim()
                const { getPlanRefinePrompt } = await import('./constants/prompts')
                const refinePrompt = getPlanRefinePrompt(
                    activePlanGoal || 'implementation plan',
                    activePlanText || '',
                    feedback
                )
                const planResult = await runAgentExecution(refinePrompt)
                activePlanText = planResult
                await handlePlanApprovalCycle(activePlanGoal || 'implementation plan', planResult)
                return
            }

            await runAgentExecution(promptText)
        },
        onExit: () => {
            handleExit()
        },
        onLoadMcpServers: async () => {
            const { listMcpServersWithScope } = await import('@december/tools')
            const list = await listMcpServersWithScope({ workspaceDir: targetWorkspaceDir })
            return list.map((item) => {
                const info = mcpClientManager.getServer(item.name)
                const stdioCfg =
                    item.config && 'command' in item.config && item.config.command
                        ? (item.config as any)
                        : null
                const target = stdioCfg
                    ? `${stdioCfg.command}${stdioCfg.args ? ' ' + stdioCfg.args.join(' ') : ''}`
                    : (item.config as any)?.url || (item.config as any)?.endpoint || ''
                return {
                    name: item.name,
                    scope: item.scope,
                    transport: (stdioCfg ? 'stdio' : 'http') as any,
                    status: (info?.status || 'disconnected') as any,
                    target,
                    eager: item.config.eager,
                    error: info?.error,
                    tools:
                        info?.tools?.map((t) => ({
                            name: t.name,
                            description: t.description,
                        })) || [],
                }
            })
        },
        onToggleMcpServer: async (name: string) => {
            const info = mcpClientManager.getServer(name)
            if (info?.status === 'connected') {
                await mcpClientManager.stopServer(name)
                agent?.unregisterMcpServerTools(name)
            } else {
                await mcpClientManager.startServer(name)
                agent?.registerMcpServerTools(name)
            }
        },
        onRestartMcpServer: async (name: string) => {
            agent?.unregisterMcpServerTools(name)
            await mcpClientManager.restartServer(name)
            agent?.registerMcpServerTools(name)
        },
        onRemoveMcpServer: async (name: string, scope: 'global' | 'project') => {
            const { removeMcpServerConfig } = await import('@december/tools')
            agent?.unregisterMcpServerTools(name)
            await mcpClientManager.removeServer(name)
            await removeMcpServerConfig(name, {
                scope,
                workspaceDir: targetWorkspaceDir,
            })
        },
        onAddMcpServer: async (data: {
            name: string
            target: string
            scope: 'global' | 'project'
            eager?: boolean
            env?: Record<string, string>
        }) => {
            const { addMcpServerConfig } = await import('@december/tools')
            const isUrl = data.target.startsWith('http://') || data.target.startsWith('https://')
            let config: any
            if (isUrl) {
                config = {
                    url: data.target,
                    scope: data.scope,
                    eager: data.eager,
                    headers: data.env,
                }
            } else {
                const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
                const parts: string[] = []
                let match
                while ((match = regex.exec(data.target)) !== null) {
                    parts.push(match[1] || match[2] || match[0])
                }
                config = {
                    command: parts[0] || data.target,
                    args: parts.length > 1 ? parts.slice(1) : undefined,
                    scope: data.scope,
                    eager: data.eager,
                    env: data.env,
                }
            }
            await addMcpServerConfig(data.name, config, {
                scope: data.scope,
                workspaceDir: targetWorkspaceDir,
            })
            await mcpClientManager.connectServer(data.name, config)
            agent?.registerMcpServerTools(data.name)
        },
        onLoadPlugins: async () => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const [installed, discoverable] = await Promise.all([
                pluginManager.getInstalledPlugins(),
                pluginManager.getDiscoverablePlugins(),
            ])
            return {
                installed: installed.map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    version: p.version,
                    author: p.author,
                    scope: p.scope,
                    enabled: p.enabled,
                    installed: true,
                    components: {
                        skills: p.components.skills.map((skill) => skill.name),
                        rules: p.components.rules.map((rule) => rule.name),
                        mcpServers: p.components.mcpServers.map((server) => server.name),
                    },
                })),
                discoverable: discoverable.map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    version: p.version,
                    author: p.author,
                    enabled: false,
                    installed: p.installed ?? false,
                    components: {
                        skills: p.defaultSkills ?? [],
                        mcpServers: p.defaultMcpServers ?? [],
                    },
                })),
            }
        },
        onTogglePlugin: async (id: string) => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const plugin = await pluginManager.togglePlugin(id)
            if (plugin && plugin.components.mcpServers.length > 0) {
                for (const s of plugin.components.mcpServers) {
                    if (plugin.enabled) {
                        try {
                            await mcpClientManager.startServer(s.name)
                            agent?.registerMcpServerTools(s.name)
                        } catch {
                            // Intentionally swallowed: mcp server auto-start fallback
                        }
                    } else {
                        try {
                            await mcpClientManager.stopServer(s.name)
                            agent?.unregisterMcpServerTools(s.name)
                        } catch {
                            // Intentionally swallowed: mcp server auto-stop fallback
                        }
                    }
                }
            }
        },
        onInstallPlugin: async (id: string) => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const installed = await pluginManager.installPlugin(id)
            if (installed && installed.components.mcpServers.length > 0) {
                for (const s of installed.components.mcpServers) {
                    try {
                        await mcpClientManager.startServer(s.name)
                        agent?.registerMcpServerTools(s.name)
                    } catch {
                        // Intentionally swallowed: mcp server auto-start fallback
                    }
                }
            }
        },
        onUninstallPlugin: async (id: string) => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const installed = (await pluginManager.getInstalledPlugins()).find((p) => p.id === id)
            if (installed && installed.components.mcpServers.length > 0) {
                for (const s of installed.components.mcpServers) {
                    try {
                        await mcpClientManager.stopServer(s.name)
                        agent?.unregisterMcpServerTools(s.name)
                    } catch {
                        // Intentionally swallowed: mcp server auto-stop fallback
                    }
                }
            }
            await pluginManager.uninstallPlugin(id)
        },
        onLoadAgentsFile: async () => {
            // Same lookup as the agent harness, so /memory shows the rules the agent reads
            const { discoverProjectRules } = await import('@december/shared')
            const files = discoverProjectRules(targetWorkspaceDir)
            if (files.length === 0) return null

            const label = (filePath: string) => {
                const relative = path.relative(process.cwd(), filePath)
                return relative.startsWith('..') ? filePath : relative
            }
            // Files come root-most first; the last one is the most specific
            const primary = files[files.length - 1]!
            if (files.length === 1) {
                return { path: label(primary.path), content: primary.content }
            }
            return {
                path: `${label(primary.path)} (+${files.length - 1} more)`,
                content: files
                    .map((file) => `── ${label(file.path)} ──\n\n${file.content}`)
                    .join('\n\n'),
            }
        },
        onScaffoldRules: async () => {
            const fs = await import('node:fs/promises')
            const { DEFAULT_AGENTS_MD_TEMPLATE } = await import('@december/tools')

            // Create the file at the git root (or the workspace when there is no repo),
            // where the rules lookup finds it from any subfolder
            let targetDir = path.resolve(targetWorkspaceDir)
            let current = targetDir
            while (true) {
                const isGitRoot = await fs
                    .stat(path.join(current, '.git'))
                    .then(() => true)
                    .catch(() => false)
                if (isGitRoot) {
                    targetDir = current
                    break
                }
                const parent = path.dirname(current)
                if (parent === current) break
                current = parent
            }

            const targetPath = path.join(targetDir, 'AGENTS.md')
            try {
                // 'wx' fails when the file exists, so an existing (even empty) file is never replaced
                await fs.writeFile(targetPath, DEFAULT_AGENTS_MD_TEMPLATE, {
                    encoding: 'utf8',
                    flag: 'wx',
                })
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                    return { success: false, message: `${targetPath} already exists.` }
                }
                throw error
            }

            if (agent?.conversation?.initSession) {
                try {
                    agent.conversation.initSession({
                        workspaceRoot: process.cwd(),
                        systemPrompt: agent.systemPrompt,
                    })
                } catch {
                    // Intentionally swallowed: agent prompt re-sync fallback
                }
            }
            return { success: true, message: `Created ${targetPath}` }
        },
        onOpenEditor: async (filePath: string) => {
            const { openPath } = await import('./utils/open')
            await openPath(filePath)
        },
    })

    const { setupAgentInterceptors } = await import('./store/interceptors')
    setupAgentInterceptors(agent, differentialApp)

    const syncTasks = () => {
        differentialApp.updateTasks(mapBackgroundTasksToTaskItems(taskManager.getTasks()))
    }
    taskManager.on('change', syncTasks)

    // Background workspace file and git status indexing for instantaneous @ and /open suggestions
    differentialApp.refreshWorkspaceFiles().catch(() => {
        // Intentionally swallowed: background workspace indexing fallback
    })

    // Background version check
    import('./utils/version-check')
        .then(({ checkForLatestVersion }) => {
            checkForLatestVersion(pkg.version).then((v) => {
                if (v) {
                    differentialApp.state.latestVersion = v
                    differentialApp.render()
                }
            })
        })
        .catch(() => {
            // Intentionally swallowed: ignore version check error
        })

    const handleExit = () => {
        taskManager.off('change', syncTasks)
        mcpClientManager.disconnectAll().catch(() => {
            // Intentionally swallowed: ignore disconnect errors on exit
        })
        differentialApp.stop()
        process.exit(0)
    }

    if (process.stdout.isTTY) {
        process.on('SIGINT', handleExit)
        process.on('SIGTERM', handleExit)
    }

    if (targetSessionId) {
        await agent.loadContext().catch(() => {
            // Intentionally swallowed: ignore context load errors on fresh sessions
        })
        differentialApp.state.messages = convertAgentMessagesToDifferentialMessages(
            agent.messages || []
        )
    } else {
        // Non-blocking session context loading during TUI mounting for fresh sessions
        agent.loadContext().catch(() => {
            // Intentionally swallowed: ignore context load errors on fresh sessions
        })
    }

    if (shouldOpenSessionMenuOnBoot) {
        differentialApp.state.activeOverlay = 'session'
        differentialApp.state.sessionSelectedIndex = 0
        differentialApp.state.sessionWindowStart = 0
    }

    const { compareVersions } = await import('./utils/bin-discovery')
    const isNewVersion =
        !config.lastSeenVersion || compareVersions(pkg.version, config.lastSeenVersion) > 0

    if (isNewVersion) {
        config.lastSeenVersion = pkg.version
        saveConfig(config).catch(() => {
            // Intentionally swallowed: config save failure should not block cli startup
        })
    }

    const { resolveAnnouncement } = await import('./utils/banner')
    const announcement = resolveAnnouncement({
        config,
        isNewVersion,
        releaseHighlights,
    })

    differentialApp.state.announcement = announcement

    differentialApp.start()
}

main().catch(console.error)
