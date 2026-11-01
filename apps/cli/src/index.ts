#!/usr/bin/env node

import path from 'node:path'

import pkg from '../package.json' with { type: 'json' }

import { parseCliArgs, getHelpText } from './args'
import { AUTH_REQUIRED_NOTICE } from './constants/messages'
import releaseHighlights from './constants/release-highlights.json' with { type: 'json' }
import { purgeProjectEnvApiKeys } from './utils/env-sanitizer'

// Ensure no API keys or tokens from project .env files are loaded into CLI process
purgeProjectEnvApiKeys()

export { parseCliArgs, getHelpText } from './args'
export { purgeProjectEnvApiKeys } from './utils/env-sanitizer'
export {
    handleLogoutCommand,
    handleSwitchCommand,
    handleLoginCommand,
    handleLinkCommand,
    handleKeyCommand,
    handleAuthCommand,
    handleUpdateCommand,
    handleDoctorCommand,
    handleMcpCommand,
} from './commands'
export { runHeadlessTask, suppressConsole, restoreConsole } from './headless-runner'
export type { HeadlessTaskOptions, HeadlessTaskResult } from './headless-runner'
export {
    resolveWorkspaceRoot,
    isWorkspaceTrusted,
    addTrustedWorkspace,
    ensureWorkspaceTrust,
} from './utils/workspace-trust'

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
        const action = parsedArgs.positionals[1] || 'status'
        const { handleMcpCommand } = await import('./commands')
        await handleMcpCommand({ action })
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
        await handleKeyCommand({ provider: targetProvider, key })
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
                thinkingLevel: config.thinkingLevel || 'auto',
            },
            sessionRepository,
            sessionId,
            runtime: 'cli',
            workspaceDir,
            thinkingLevel: config.thinkingLevel || 'auto',
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
    const allSessions = await sessionRepository.listSessions()
    let targetSessionId = parsedArgs.sessionId
    const isExplicitResumeCmd = parsedArgs.command === 'resume'
    const isResumeFlag = Boolean(parsedArgs.resume)
    let shouldOpenSessionMenuOnBoot = false

    if (isExplicitResumeCmd || isResumeFlag) {
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
    const mcpConfigs = await toolsModule.loadMcpConfig({ workspaceDir: targetWorkspaceDir })
    if (Object.keys(mcpConfigs).length > 0) {
        await mcpClientManager.connectAll(mcpConfigs).catch(() => {
            // Intentionally swallowed: ignore MCP connection errors on startup
        })
    }

    const harness = new AgentHarness({
        llm: llm,
        tools: toolsModule.CORE_TOOLS,
        deferredTools: toolsModule.DEFERRED_TOOLS,
        mcpClientManager,
        operations: localOperations,
        modelOptions: {
            model: initialModel,
            thinkingLevel: config.thinkingLevel || 'auto',
        },
        sessionRepository,
        sessionId,
        runtime: 'cli',
        workspaceDir: targetWorkspaceDir,
        thinkingLevel: config.thinkingLevel || 'auto',
        steeringMode: config.steeringMode || 'all',
        followUpMode: config.followUpMode || 'all',
    })

    const agent = harness.getAgent()

    const userEmail = config.decemberToken
        ? config.email
        : providerConfig?.subscription?.email || config.email || undefined

    const differentialApp = new DifferentialApp({
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
        thinkingLevel: config.thinkingLevel || 'auto',
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
            try {
                const cfg = await loadConfig()
                await saveConfig({ ...cfg, thinkingLevel: level })
            } catch {
                // Intentionally swallowed: ignore thinking level config save error
            }
        },
        onModelSelect: async (selected) => {
            try {
                const cfg = await loadConfig()
                cfg.activeModel = selected.value
                await saveConfig(cfg)
                if (agent && agent.modelOptions) {
                    agent.modelOptions.model = selected.value
                }
                differentialApp.state.activeModel = selected.value
                differentialApp.state.modelLabel = selected.label
                differentialApp.state.maxContextTokens = getModelContextWindow(selected.value)
                differentialApp.render()
            } catch {
                // Intentionally swallowed: ignore model config save error
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
            } catch {
                // Intentionally swallowed: ignore login config save error
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
                ).catch(() => {
                    // Intentionally swallowed: background live model fetch failure
                })
            } catch {
                // Intentionally swallowed: ignore subscription config save error
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
                differentialApp.refreshModelsForProvider(provider)
                fetchLiveProviderModels(provider, apiKey).catch(() => {
                    // Intentionally swallowed: background live model fetch failure
                })
            } catch {
                // Intentionally swallowed: ignore config save failure
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
                        differentialApp.showToast(
                            `Command moved to background (${taskId}). Use /tasks to view logs.`,
                            'info'
                        )
                    },
                })
                const result = await promise
                differentialApp.updateToolResult(toolCallId, {
                    output: result.output,
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
            }
        },
        onUndo: async () => {
            try {
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
        onSubmit: async (promptText: string) => {
            if (!differentialApp.state.isAuthenticated) {
                differentialApp.state.messages.push({
                    role: 'assistant',
                    content: AUTH_REQUIRED_NOTICE,
                })
                differentialApp.state.isStreaming = false
                differentialApp.render()
                return
            }

            differentialApp.state.isStreaming = true
            differentialApp.render()

            try {
                let executionPrompt = promptText

                if (promptText.startsWith('/plan ') || promptText === '/plan') {
                    const goal = promptText.replace(/^\/plan\s*/, '').trim()
                    if (goal) {
                        const { getPlanPrompt } = await import('./constants/prompts')
                        executionPrompt = getPlanPrompt(goal, [])
                    }
                }

                if (executionPrompt.includes('@') && !executionPrompt.includes('<context_file')) {
                    try {
                        const { resolveContextMentions } = await import('@december/shared')
                        const resolved = await resolveContextMentions(
                            executionPrompt,
                            process.cwd()
                        )
                        executionPrompt = resolved.expandedPrompt
                    } catch {
                        // Intentionally swallowed: keep executionPrompt on resolution error
                    }
                }

                const { getToolSummary } = await import('./utils/formatters')
                const stream = runAgentLoop(agent, executionPrompt)
                for await (const event of stream) {
                    if (event.type === 'StreamChunk') {
                        differentialApp.appendStreamDelta(event.content)
                    } else if (event.type === 'ThinkingChunk') {
                        differentialApp.appendThinkingChunk(event.content)
                    } else if (event.type === 'ToolCallStart') {
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
                    }
                }
            } catch (err: any) {
                differentialApp.state.messages.push({
                    role: 'error',
                    content: err.message || 'Execution error',
                })
            } finally {
                differentialApp.state.isStreaming = false
                differentialApp.render()
                differentialApp.refreshWorkspaceFiles().catch(() => {
                    // Intentionally swallowed: refresh workspace files after agent turn
                })
            }
        },
        onExit: () => {
            handleExit()
        },
        onLoadMemoryDetails: async () => {
            const { getWorkspaceMemoryDetails } = await import('@december/tools')
            return getWorkspaceMemoryDetails(process.cwd())
        },
        onLoadProjectRules: async () => {
            const { discoverProjectRules } = await import('@december/shared')
            return discoverProjectRules(process.cwd())
        },
        onRecordMemory: async (text: string, category: string) => {
            const { recordMemoryDirect } = await import('@december/tools')
            const res = await recordMemoryDirect(process.cwd(), text, category)
            if (res.success && agent?.conversation?.initSession) {
                try {
                    agent.conversation.initSession({
                        workspaceRoot: process.cwd(),
                        systemPrompt: agent.systemPrompt,
                    })
                } catch {
                    // Intentionally swallowed: agent prompt re-sync fallback
                }
            }
            return res
        },
        onForgetMemory: async (text: string) => {
            const { forgetMemoryDirect } = await import('@december/tools')
            const res = await forgetMemoryDirect(process.cwd(), text)
            if (res.success && agent?.conversation?.initSession) {
                try {
                    agent.conversation.initSession({
                        workspaceRoot: process.cwd(),
                        systemPrompt: agent.systemPrompt,
                    })
                } catch {
                    // Intentionally swallowed: agent prompt re-sync fallback
                }
            }
            return res
        },
        onScaffoldRules: async () => {
            const fs = await import('node:fs/promises')
            const path = await import('node:path')
            const { DEFAULT_AGENTS_MD_TEMPLATE } = await import('@december/tools')
            const targetPath = path.join(process.cwd(), 'AGENTS.md')
            await fs.writeFile(targetPath, DEFAULT_AGENTS_MD_TEMPLATE, 'utf8')
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
            return { success: true, message: 'Created AGENTS.md' }
        },
        onOpenEditor: async (filePath: string) => {
            const { openPath } = await import('./utils/open')
            await openPath(filePath)
        },
    })

    const { setupAgentInterceptors } = await import('./store/interceptors')
    setupAgentInterceptors(agent, differentialApp)

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
