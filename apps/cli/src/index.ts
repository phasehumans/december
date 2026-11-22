#!/usr/bin/env node

import pkg from '../package.json' with { type: 'json' }

const rawArgs = process.argv.slice(2)
if (rawArgs.length === 1 && (rawArgs[0] === '-v' || rawArgs[0] === '--version')) {
    console.log(pkg.version)
    process.exit(0)
}

import nodeModule from 'node:module'
import path from 'node:path'

import { parseCliArgs, getHelpText } from './args'
import { AUTH_REQUIRED_NOTICE } from './constants/messages'
import releaseHighlights from './constants/release-highlights.json' with { type: 'json' }
import { purgeProjectEnvApiKeys } from './utils/env-sanitizer'

import type { DecemberConfig } from './config'
import type { DifferentialApp, TaskItem } from '@december/tui'

// Node 22.1+ keeps compiled code on disk, so later starts skip parsing the bundle again.
// Older Node versions and Bun do not have it.
try {
    const { enableCompileCache } = nodeModule as { enableCompileCache?: () => unknown }
    enableCompileCache?.()
} catch {
    // Intentionally swallowed: the compile cache only makes startup faster
}

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

    // --perf (or -perf) turns on the TUI performance overlay, read when the TUI is created
    if (parsedArgs.perf) {
        process.env.DECEMBER_PERF = '1'
    }

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
        await handleUpdateCommand({ force: parsedArgs.force, check: parsedArgs.check })
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

    // 'undo' is a hidden alias of 'rewind'
    if (parsedArgs.command === 'rewind' || parsedArgs.command === 'undo') {
        const turnArg = parsedArgs.positionals[1]
        const turn =
            turnArg && !isNaN(parseInt(turnArg, 10)) ? parseInt(turnArg, 10) : parsedArgs.turn
        const list = parsedArgs.positionals[1] === 'list' || parsedArgs.list
        const { handleRewindCommand } = await import('./commands')
        await handleRewindCommand({ turn, list })
        process.exit(process.exitCode || 0)
    }

    if (parsedArgs.command === 'plugin' || parsedArgs.command === 'plugins') {
        const { handlePluginCommand } = await import('./commands')
        await handlePluginCommand({
            action: parsedArgs.positionals[1],
            target: parsedArgs.positionals[2],
            extra: parsedArgs.positionals[3],
            scope: parsedArgs.isGlobal ? 'user' : parsedArgs.scope,
        })
        process.exit(process.exitCode || 0)
    }

    // december skill was folded into december plugin. Keep the word known so
    // "december skill list" prints a pointer instead of running as a prompt.
    if (parsedArgs.command === 'skill' || parsedArgs.command === 'skills') {
        const { printSkillCommandMoved } = await import('./commands')
        printSkillCommandMoved()
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
        // G2: headless runs pick their model from what the provider serves now (D1, D5)
        // a fresh cached list answers at once; a slow network costs at most 3s before the run
        if (providerConfig?.apiKey && providerConfig.authMethod !== 'december') {
            const { fetchLiveProviderModels } = await import('./utils/models')
            await Promise.race([
                fetchLiveProviderModels(
                    providerConfig.provider,
                    providerConfig.apiKey,
                    providerConfig.baseURL
                ),
                new Promise((resolve) => setTimeout(resolve, 3000)),
            ])
        }
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
        // headless runs exit right after the task, so they keep the instant prompt title only
        await agent.ensurePromptTitle(rawPrompt).catch(() => {
            // Intentionally swallowed: a missing title never blocks the task
        })

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
        { openaiProvider },
        toolsModule,
        { DifferentialApp },
        { FileSessionRepository },
        {
            getProviderConfig,
            loadConfig,
            saveConfig,
            getAuthStatus,
            getConfiguredProviders,
            getConfigDir,
        },
        { suppressConsole },
        { localOperations, setActiveScopeDir },
        { instantiateProvider },
        {
            ensureValidModelForProvider,
            getModelLabel,
            getProviderModels,
            isValidModelForProvider,
            pickModelForProvider,
            getModelContextWindow,
        },
        { useCliStore },
        { convertAgentMessagesToDifferentialMessages },
        { recordUsage, getUsageHistory },
        { fetchDecemberCreditsInCents },
        { buildSettingsFromConfig },
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
        import('./utils/usage-tracker'),
        import('./utils/december-credits'),
        import('./settings-menu'),
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
    let unmatchedSessionRef: string | undefined

    if (isExplicitResumeCmd || isResumeFlag) {
        allSessions = await sessionRepository.listSessions()
        // `december resume rewind fix` works without quotes, so join the remaining words
        const sessionRef = isExplicitResumeCmd
            ? parsedArgs.positionals.slice(1).join(' ').trim()
            : ''
        if (!targetSessionId && sessionRef) {
            const { resolveSessionRef } = await import('./utils/session-ref')
            const match = resolveSessionRef(sessionRef, allSessions)
            if (match) {
                targetSessionId = match.id
            } else {
                unmatchedSessionRef = sessionRef
            }
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
                        title: s.title,
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

    // Start or stop the MCP servers a plugin ships. A config-file server with the
    // same name wins over the plugin's, so only servers the plugin owns are touched.
    const syncPluginMcpServers = async (
        plugin: { id: string; components: { mcpServers: Array<{ name: string }> } },
        running: boolean
    ) => {
        const { getMcpServerConfig } = await import('@december/tools')
        for (const server of plugin.components.mcpServers) {
            try {
                if (running) {
                    const live = await getMcpServerConfig(server.name, {
                        workspaceDir: targetWorkspaceDir,
                    })
                    if (!live || live.plugin !== plugin.id) continue
                    await mcpClientManager.startServer(server.name, live.config)
                    agent?.registerMcpServerTools(server.name)
                } else {
                    const live = mcpClientManager.getServer(server.name)
                    const owned = await getMcpServerConfig(server.name, {
                        workspaceDir: targetWorkspaceDir,
                    })
                    if (owned && !owned.plugin) continue
                    if (live) {
                        agent?.unregisterMcpServerTools(server.name)
                        await mcpClientManager.removeServer(server.name)
                    }
                }
            } catch {
                // Intentionally swallowed: a server that fails shows as failed in /mcp
            }
        }
    }

    const userEmail = config.decemberToken
        ? config.email
        : providerConfig?.subscription?.email || config.email || undefined

    let differentialApp: DifferentialApp

    /**
     * G1: reads the active provider's model list again when the cached one is older than 24h,
     * so /model and the model checks keep using what the provider serves (D1), not the catalog.
     */
    const refreshActiveModels = async (): Promise<void> => {
        try {
            const { getProviderConfig } = await import('./config')
            const pc = await getProviderConfig()
            if (!pc?.provider || !pc.apiKey) return
            const { fetchLiveProviderModels } = await import('./utils/models')
            const result = await fetchLiveProviderModels(pc.provider, pc.apiKey, pc.baseURL)
            if (result.ok === true && differentialApp) {
                differentialApp.refreshModelsForProvider(pc.provider)
                const active = differentialApp.state.activeModel
                if (active) {
                    differentialApp.state.maxContextTokens = getModelContextWindow(
                        active,
                        pc.provider
                    )
                }
                differentialApp.render()
            }
        } catch {
            // Intentionally swallowed: a failed background refresh keeps the cached or catalog list
        }
    }

    let activePlanGoal: string | null = null
    let activePlanText: string | null = null
    let userHooks: import('./utils/user-hooks-setup').UserHooksController | undefined

    const runAgentExecution = async (promptText: string): Promise<string> => {
        let streamedResponse = ''
        differentialApp.state.isStreaming = true
        differentialApp.startSpinner()
        differentialApp.render()

        try {
            const { getProviderConfig, loadConfig } = await import('./config')
            const cfg = await loadConfig()
            const providerCfg = await getProviderConfig(cfg)
            const activeProv = providerCfg?.provider || cfg.activeProvider || 'gemini'
            const activeMod = agent.modelOptions?.model || cfg.activeModel
            const { isValidModelForProvider, pickModelForProvider, modelFallbackHint } =
                await import('./utils/models')
            const { getCleanProviderDisplayName } = await import('@december/shared')
            if (activeMod && !isValidModelForProvider(activeProv, activeMod)) {
                const displayName = getCleanProviderDisplayName(activeProv, activeMod)
                // D5: the best model this key can use, never the one that is not available
                const fallback = pickModelForProvider(activeProv, [activeMod])
                const hasFallback = Boolean(fallback)
                const hintText = modelFallbackHint(fallback)
                const errorMsg = `Model '${activeMod}' is not available on ${displayName} for this key.`
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

            if (userHooks) {
                const { appendHookContext } = await import('./utils/user-hooks-setup')
                const hookOutcome = await userHooks.runPromptSubmit(executionPrompt)
                if (hookOutcome.block) {
                    differentialApp.clearStatusMessage()
                    differentialApp.state.messages.push({
                        role: 'error',
                        content: `Prompt blocked by a UserPromptSubmit hook: ${hookOutcome.block}`,
                    })
                    differentialApp.render()
                    return ''
                }
                executionPrompt = appendHookContext(executionPrompt, hookOutcome.context)
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
                } else if (event.type === 'AgentRetry') {
                    differentialApp.setRetry({
                        attempt: event.attempt,
                        maxAttempts: event.maxAttempts,
                        delayMs: event.delayMs,
                        reason: event.reason,
                    })
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
                    let errorHint = event.hint
                    let errorContent = event.error
                    let errorCode = event.code
                    let fallbackModel: string | undefined
                    const failedModel = event.model || activeMod || 'unknown'
                    if (errorCode === 'ENDPOINT_NOT_FOUND') {
                        // some providers (nvidia) answer an unknown model with a bare 404; the
                        // live list tells that apart from a wrong base url
                        const { getLiveProviderModels } = await import('./utils/models')
                        const errProvider = event.provider || activeProv
                        if (
                            getLiveProviderModels(errProvider) &&
                            !isValidModelForProvider(errProvider, failedModel)
                        ) {
                            errorCode = 'MODEL_UNAVAILABLE'
                            const { getCleanProviderDisplayName } = await import('@december/shared')
                            errorContent = `Model '${failedModel}' is not available on ${getCleanProviderDisplayName(errProvider, failedModel)} for this key.\n${event.error}`
                        }
                    }
                    if (errorCode === 'MODEL_UNAVAILABLE') {
                        // D5 with the provider's live list; the agent only knows the catalog
                        // the model is marked unavailable only when the user accepts the switch
                        const { pickModelForProvider, modelFallbackHint } =
                            await import('./utils/models')
                        const errProvider = event.provider || activeProv
                        fallbackModel = pickModelForProvider(errProvider, [failedModel])
                        errorHint = modelFallbackHint(fallbackModel)
                    }
                    differentialApp.state.messages.push({
                        role: 'error',
                        content: errorContent,
                        cause: event.cause,
                        hint: errorHint,
                    })
                    if (errorCode === 'MODEL_UNAVAILABLE' && fallbackModel) {
                        differentialApp.setPendingModelFallback({
                            provider: event.provider || activeProv,
                            failedModel,
                            fallbackModel,
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
                        mcpServer: event.mcpServer,
                        mcpTool: event.mcpTool,
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
                    differentialApp.addTurnOutputTokens(event.completionTokens)
                    void recordUsage({ ...event, sessionId: agent.sessionId })
                    differentialApp.render()
                } else if (event.type === 'ContextCompacted') {
                    differentialApp.appendCompactionMarker({
                        tokensBefore: event.tokensBefore,
                        tokensAfter: event.tokensAfter,
                    })
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
            // runs in the background: the next prompt does not wait for the title
            agent
                .upgradeAutoTitle()
                .then((title) => {
                    if (title && differentialApp.state.sessionId === agent.sessionId) {
                        differentialApp.setSessionTitle(title)
                        differentialApp.render()
                    }
                })
                .catch(() => {
                    // Intentionally swallowed: the session keeps its prompt title
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

    const { taskManager } = await import('./task-manager')
    type BackgroundTask = import('./task-manager').BackgroundTask

    const { getDisplayOutput } = await import('./task-manager')

    const mapBackgroundTasksToTaskItems = (tasks: BackgroundTask[]): TaskItem[] => {
        return tasks.map((t) => ({
            id: t.id,
            command: t.command,
            type: t.type === 'subagent' ? 'subagent' : 'shell',
            status: t.status,
            createdAt: t.createdAt.getTime(),
            completedAt: t.completedAt?.getTime(),
            exitCode: t.exitCode ?? undefined,
            pid: t.pid,
            role: t.role,
            depth: t.depth,
            turns: t.turns,
            output: getDisplayOutput(t),
        }))
    }

    const applyThinkingLevel = (level: string) => {
        agent.thinkingLevel = level
        if (agent.modelOptions) {
            agent.modelOptions.thinkingLevel = level
        }
        harness.updateThinkingLevel(level)
    }

    differentialApp = new DifferentialApp({
        settings: buildSettingsFromConfig(config, activeProvider, initialModel),
        notifyMode: config.notify,
        // #617: the hooks load after the app, so read userHooks when the event fires
        onAttention: ({ reason, message }) => {
            void userHooks?.runNotification(reason, message)
        },
        tasks: mapBackgroundTasksToTaskItems(taskManager.getTasks()),
        onKillTask: (taskId: string) => {
            taskManager.killTask(taskId, 'user')
        },
        onClearCompletedTasks: () => {
            taskManager.clearCompleted()
        },
        onBackgroundForeground: () => taskManager.backgroundForeground(),
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
        maxContextTokens: getModelContextWindow(initialModel, activeProvider),
        sessionId,
        thinkingLevel: config.thinkingLevel || 'fast',
        onAbort: () => {
            if (agent?.activeAbortController) {
                agent.activeAbortController.abort()
            }
        },
        sessions: allSessions.map((s) => ({
            id: s.id,
            title: s.title,
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
                differentialApp.setSessionTitle(agent.sessionTitle)
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
        onSessionRename: async (sessionId: string, newTitle: string) => {
            try {
                if (agent && sessionId === agent.sessionId) {
                    await agent.setSessionTitle(newTitle, 'manual')
                } else {
                    const { normalizeSessionTitle } = await import('@december/agent')
                    const title = normalizeSessionTitle(newTitle)
                    if (title) {
                        await sessionRepository.setSessionMeta(sessionId, {
                            title,
                            titleSource: 'manual',
                        })
                    }
                }
            } catch (err: any) {
                differentialApp.showToast(
                    `Failed to save session title: ${err?.message || err}`,
                    'error'
                )
            }
        },
        onRenameSession: async (title?: string) => {
            if (!agent) return
            if (title) {
                await agent.setSessionTitle(title, 'manual')
                return agent.sessionTitle
            }
            const hasConversation = agent.messages.some((m) => m.role === 'user')
            if (!hasConversation) {
                throw new Error('nothing to name yet, send a prompt first')
            }
            const generated = await agent.generateSessionTitle()
            if (!generated) return
            // a title the user asked for is locked, so later turns never replace it
            await agent.setSessionTitle(generated, 'manual')
            return agent.sessionTitle
        },
        // Save first, then change the running session: a failed save rejects, and the TUI
        // reverts the value and shows an error
        onEffortSelect: async (level) => {
            const cfg = await loadConfig()
            await saveConfig({ ...cfg, thinkingLevel: level })
            applyThinkingLevel(level)
        },
        onSettingChange: async (settingId: string, newValue: string) => {
            const cfg = await loadConfig()
            if (settingId === 'pathguard') {
                cfg.pathGuard = newValue === 'on'
            } else if (settingId === 'non_workspace') {
                cfg.nonWorkspaceAccess = newValue === 'on'
            } else if (settingId === 'tool_permission') {
                cfg.toolPermission = newValue as 'always-proceed' | 'always-ask'
            } else if (settingId === 'thinking_level') {
                cfg.thinkingLevel = newValue as DecemberConfig['thinkingLevel']
            } else if (settingId === 'steering_mode') {
                cfg.steeringMode = newValue as 'all' | 'one-at-a-time'
            } else if (settingId === 'browser_visible') {
                cfg.browserVisible = newValue === 'on'
            } else if (settingId === 'notify') {
                cfg.notify = newValue as 'off' | 'bell' | 'desktop'
            }
            await saveConfig(cfg)

            if (settingId === 'thinking_level') {
                applyThinkingLevel(newValue)
            } else if (settingId === 'steering_mode' && agent?.steeringQueue) {
                agent.steeringQueue.mode = newValue as 'all' | 'one-at-a-time'
            } else if (settingId === 'notify') {
                differentialApp.setNotifyMode(newValue)
            }
        },
        onModelMenuOpen: () => {
            void refreshActiveModels()
        },
        onCheckModel: (selected) => {
            const provider = differentialApp.state.selectedProvider || ''
            if (!provider || isValidModelForProvider(provider, selected.value)) {
                return { available: true }
            }
            const fallbackId = pickModelForProvider(provider, [selected.value])
            const fallback = fallbackId
                ? getProviderModels(provider).find((m) => m.value === fallbackId) || {
                      label: fallbackId,
                      value: fallbackId,
                  }
                : undefined
            return { available: false, fallback }
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
                differentialApp.state.maxContextTokens = getModelContextWindow(
                    selected.value,
                    activeProv
                )
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
                differentialApp.state.maxContextTokens = getModelContextWindow(
                    fallbackModel,
                    activeProv
                )
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
                    .then((result) => {
                        if (result.ok === true) {
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
        onSaveApiKey: async (provider: string, apiKey: string, signal?: AbortSignal) => {
            const { checkProviderKey, getDefaultModelForProvider } = await import('./utils/models')
            const cfgBefore = await loadConfig()
            const baseUrl = cfgBefore.providerBaseUrls?.[provider]
            const check = await checkProviderKey(provider, apiKey, baseUrl)
            // the user pressed esc while the provider answered: save nothing
            if (signal?.aborted) {
                return { status: 'error' as const, message: 'Key check cancelled.' }
            }
            if (check.status === 'rejected') {
                return { status: 'rejected' as const, message: check.message }
            }
            try {
                const cfg = await loadConfig()
                cfg.providers = cfg.providers || {}
                cfg.providers[provider] = apiKey
                cfg.activeProvider = provider
                cfg.authPriority = 'byok'
                // D5: first catalog-preferred model the key can use (live list when we have one)
                const targetModel = getDefaultModelForProvider(provider)
                cfg.activeModel = targetModel
                await saveConfig(cfg)
                differentialApp.state.selectedProvider = provider
                differentialApp.state.authMethod = 'byok'
                differentialApp.state.activeModel = targetModel
                differentialApp.state.modelLabel = getModelLabel(targetModel)
                differentialApp.state.maxContextTokens = getModelContextWindow(
                    targetModel,
                    provider
                )
                differentialApp.state.switchItems = getConfiguredProviders(cfg)
                differentialApp.state.isAuthenticated = true
                differentialApp.refreshModelsForProvider(provider)
                if (agent) {
                    const { instantiateProvider } = await import('./utils/provider-factory')
                    const llm = instantiateProvider(provider, apiKey, {
                        authMethod: 'byok',
                        baseURL: baseUrl,
                    })
                    agent.setLLM(llm)
                    if (agent.modelOptions) {
                        agent.modelOptions.model = targetModel
                    }
                }
                differentialApp.render()
            } catch (err: any) {
                return {
                    status: 'error' as const,
                    message: `Failed to save API key: ${err?.message || 'Error'}`,
                }
            }
            if (check.status === 'forbidden') {
                return { status: 'forbidden' as const, message: check.message }
            }
            if (check.status === 'unverified') {
                return { status: 'unverified' as const, message: check.message }
            }
            return { status: 'saved' as const }
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
            void refreshActiveModels()
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
        onRewindTurn: async (snapshotId: string) => {
            try {
                const result = await agent.rollbackToSnapshot(snapshotId)
                differentialApp.state.messages = convertAgentMessagesToDifferentialMessages(
                    agent.messages || []
                )
                const count = result.restoredFiles.length + result.deletedFiles.length
                const filesLabel = `${count} file${count === 1 ? '' : 's'}`
                if (result.failedFiles.length > 0) {
                    differentialApp.showToast(
                        `Rewound to turn ${result.targetTurn} (${filesLabel}), but ${result.failedFiles.length} could not be restored: ${result.failedFiles.slice(0, 3).join(', ')}`,
                        'error'
                    )
                } else {
                    differentialApp.showToast(
                        `Rewound to turn ${result.targetTurn} (${filesLabel} restored)`,
                        'success'
                    )
                }
                differentialApp.render()
            } catch (e: any) {
                differentialApp.showToast(`Failed to rewind: ${e.message}`, 'error')
            }
        },
        onLoadUsage: async () => {
            const isDecemberCloud = differentialApp.state.authMethod === 'december'
            const [history, creditsRemainingInCents] = await Promise.all([
                getUsageHistory(),
                isDecemberCloud
                    ? loadConfig().then((c) => fetchDecemberCreditsInCents(c.decemberToken))
                    : Promise.resolve(undefined),
            ])
            return { history, creditsRemainingInCents }
        },
        onLoadRewindTurns: async () => {
            try {
                const snapshots = await agent.getRewindableSnapshots()
                return snapshots.map((s) => ({
                    id: s.id,
                    turnIndex: s.turnIndex,
                    commitHash: s.commitHash,
                    prompt: s.prompt,
                    timestamp: s.timestamp,
                    touchedFiles: s.touchedFiles,
                }))
            } catch {
                // Intentionally swallowed: the picker shows its empty state
                return []
            }
        },
        onLoadSessionChanges: async () => {
            const changes = await agent.getSessionChanges()
            if (!changes) return null
            // Snapshot paths are relative to the workspace; /diff reads files from the cwd
            const workspaceDir = agent.workspaceDir || process.cwd()
            return changes.map((c) => ({
                ...c,
                path: path.relative(process.cwd(), path.resolve(workspaceDir, c.path)),
            }))
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
                differentialApp.setSessionTitle(undefined)
                differentialApp.render()
                return agent.sessionId
            }
        },
        onForkContext: async (newSessionId?: string) => {
            if (agent) {
                const newId = await agent.forkContext(newSessionId)
                differentialApp.state.sessionId = newId
                differentialApp.setSessionTitle(agent.sessionTitle)
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

            if (promptText === '/learn' || promptText.startsWith('/learn ')) {
                const { getLearnPrompt } = await import('./constants/prompts')
                const { resolveLearnTarget } = await import('./utils/learn-target')
                const target = resolveLearnTarget(targetWorkspaceDir)
                const learnPrompt = getLearnPrompt({
                    lesson: promptText.replace(/^\/learn\s*/, '').trim(),
                    ruleFile: target.ruleFile,
                    ruleFileExists: target.ruleFileExists,
                    nestedRuleFiles: target.nestedRuleFiles,
                    skillsDir: target.skillsDir,
                    existingSkillNames: target.existingSkillNames,
                })
                await runAgentExecution(learnPrompt)
                return
            }

            const isPlanRefine = promptText.startsWith('/plan refine')
            const titleSeed = promptText.replace(/^\/plan(\s+refine:?)?\s*/i, '').trim()
            if (titleSeed && !/^\/plan\s+(approve|reject)\b/i.test(promptText)) {
                agent
                    .ensurePromptTitle(titleSeed)
                    .then(() => {
                        if (agent.sessionTitle !== differentialApp.state.sessionTitle) {
                            differentialApp.setSessionTitle(agent.sessionTitle)
                            differentialApp.render()
                        }
                    })
                    .catch(() => {
                        // Intentionally swallowed: a missing title never blocks the prompt
                    })
            }
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
                    plugin: item.plugin,
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
                // /mcp starts a server for this session, even one saved as off
                await mcpClientManager.startServer(
                    name,
                    info?.config ? { ...info.config, disabled: false } : undefined
                )
                agent?.registerMcpServerTools(name)
            }
        },
        onRunUpdate: async () => {
            // Load everything up front: the install replaces this package's files on
            // disk, so lazy chunks of the running version cannot be imported afterwards.
            const [{ performCliUpdate }, { formatUpdateNotice }] = await Promise.all([
                import('./utils/updater'),
                import('./commands/update'),
            ])
            await agent.saveContext().catch(() => {
                // Intentionally swallowed: the update itself does not depend on the save
            })
            differentialApp.setUpdateStatus('Checking for updates')
            try {
                const result = await performCliUpdate({
                    currentVersion: pkg.version,
                    onProgress: (msg) => differentialApp.setUpdateStatus(msg.replace(/\.+$/, '')),
                })
                differentialApp.setUpdateStatus(undefined)
                const notice = formatUpdateNotice(result)
                const installed = result.success && result.verified && !result.alreadyUpToDate
                if (installed) {
                    differentialApp.state.latestVersion = undefined
                }
                if (notice.message) {
                    differentialApp.appendMessage(notice.message)
                    differentialApp.state.scrollOffset = undefined
                }
                differentialApp.showToast(notice.toast, notice.variant)
                if (installed) {
                    differentialApp.setPendingRestart(
                        result.installedVersion || result.targetVersion || 'latest'
                    )
                }
            } finally {
                differentialApp.setUpdateStatus(undefined)
            }
        },
        onRestart: async () => {
            await restartIntoUpdatedVersion()
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
            const { loadPluginCatalog } = await import('@december/tools')
            const catalog = await loadPluginCatalog({
                workspaceDir: targetWorkspaceDir,
                mcpStatus: (name) => {
                    const info = mcpClientManager.getServer(name)
                    return info
                        ? { status: info.status, toolCount: info.tools.length, error: info.error }
                        : undefined
                },
            })
            return {
                installed: catalog.installed,
                discover: catalog.discover,
                marketplaces: catalog.marketplaces.map((m) => ({
                    name: m.name,
                    source: m.source,
                    builtIn: m.builtIn,
                    available: m.plugins.length,
                    installedCount: m.installedCount,
                    updatedAt: m.updatedAt,
                    error: m.error,
                })),
            }
        },
        onTogglePluginItem: async (item) => {
            const tools = await import('@december/tools')
            if (item.kind === 'plugin') {
                const pluginManager = new tools.PluginManager({ workspaceDir: targetWorkspaceDir })
                const plugin = await pluginManager.togglePlugin(item.id)
                await syncPluginMcpServers(plugin, plugin.enabled)
                return {
                    enabled: plugin.enabled,
                    restartRequired: plugin.components.skills.length > 0,
                }
            }
            if (item.kind === 'skill') {
                const { SkillDiscoveryEngine, writeExtensionPreference } =
                    await import('@december/shared')
                const skill = new SkillDiscoveryEngine({
                    workspaceDir: targetWorkspaceDir,
                    includeDisabled: true,
                })
                    .discoverAllSkills()
                    .find((s) => s.name === item.id)
                const enabled = !(skill?.enabled !== false)
                await writeExtensionPreference({
                    kind: 'skill',
                    id: item.id,
                    enabled,
                    scope: item.scope === 'project' ? 'project' : 'user',
                    workspaceDir: targetWorkspaceDir,
                })
                return { enabled, restartRequired: true }
            }
            const current = await tools.getMcpServerConfig(item.id, {
                workspaceDir: targetWorkspaceDir,
            })
            if (!current || current.plugin) {
                throw new Error(`${item.id} is not in an MCP config file.`)
            }
            const disable = !current.config.disabled
            await tools.setMcpServerDisabled(item.id, disable, {
                scope: current.scope,
                workspaceDir: targetWorkspaceDir,
            })
            if (disable) {
                agent?.unregisterMcpServerTools(item.id)
                await mcpClientManager.stopServer(item.id)
            } else {
                await mcpClientManager.startServer(item.id, { ...current.config, disabled: false })
                agent?.registerMcpServerTools(item.id)
            }
            return { enabled: !disable, restartRequired: false }
        },
        onInstallPlugin: async (id, scope) => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const installed = await pluginManager.installPlugin(id, { scope })
            await syncPluginMcpServers(installed, installed.enabled)
            return { name: installed.name }
        },
        onInstallPluginFromSource: async (source, scope) => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const installed = await pluginManager.installFromSource(source, { scope })
            await syncPluginMcpServers(installed, installed.enabled)
            return { name: installed.name }
        },
        onUpdatePlugin: async (id) => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const before = (await pluginManager.getInstalledPlugins()).find((p) => p.id === id)
            if (before) await syncPluginMcpServers(before, false)
            const updated = await pluginManager.updatePlugin(id)
            await syncPluginMcpServers(updated, updated.enabled)
            return { name: updated.name, version: updated.version }
        },
        onUninstallPlugin: async (id: string) => {
            const { PluginManager } = await import('@december/tools')
            const pluginManager = new PluginManager({ workspaceDir: targetWorkspaceDir })
            const installed = (await pluginManager.getInstalledPlugins()).find((p) => p.id === id)
            if (installed) await syncPluginMcpServers(installed, false)
            await pluginManager.uninstallPlugin(id)
        },
        onAddMarketplace: async (source) => {
            const { MarketplaceRegistry } = await import('@december/tools')
            const added = await new MarketplaceRegistry().add(source)
            return { name: added.name, available: added.plugins.length }
        },
        onUpdateMarketplace: async (name) => {
            const { MarketplaceRegistry } = await import('@december/tools')
            await new MarketplaceRegistry().update(name)
        },
        onRemoveMarketplace: async (name) => {
            const { MarketplaceRegistry } = await import('@december/tools')
            await new MarketplaceRegistry().remove(name)
        },
        onRunChecks: async () => {
            const { runDoctorChecks } = await import('./utils/doctor-checks')
            const { listMcpServersWithScope } = await import('@december/tools')
            const servers = await listMcpServersWithScope({ workspaceDir: targetWorkspaceDir })
            return runDoctorChecks({
                workspaceDir: targetWorkspaceDir,
                includeInstall: true,
                mcpServers: servers.map((item) => {
                    const info = mcpClientManager.getServer(item.name)
                    return {
                        name: item.name,
                        scope: item.plugin ? `plugin ${item.plugin}` : item.scope,
                        status: (info?.status || 'disconnected') as
                            | 'connected'
                            | 'connecting'
                            | 'disconnected'
                            | 'error',
                        error: info?.error,
                    }
                }),
            })
        },
        // the permission gate (store/interceptors) reads rules from the cwd, so these do too
        onLoadPermissions: async () => {
            const { readPermissionRules, getRuleFilePath } =
                await import('./utils/permission-rules')
            const { toDisplayPath } = await import('./utils/doctor-checks')
            const cfg = await loadConfig()
            const rules = readPermissionRules(process.cwd())
            return {
                ...rules,
                toolPermission: cfg.toolPermission ?? 'always-proceed',
                globalPath: toDisplayPath(getRuleFilePath('global', process.cwd())),
                projectPath: toDisplayPath(getRuleFilePath('project', process.cwd())),
            }
        },
        onChangePermissionRule: async (change) => {
            const { addPermissionRule, removePermissionRule } =
                await import('./utils/permission-rules')
            if (change.action === 'add') {
                addPermissionRule(change.kind, change.scope, change.pattern, process.cwd())
            } else {
                removePermissionRule(change.kind, change.scope, change.pattern, process.cwd())
            }
        },
        onLoadGithubSetup: async () => {
            const gh = await import('./utils/github-setup')
            const { toDisplayPath } = await import('./utils/doctor-checks')
            const cfg = await loadConfig()
            const plan = gh.resolveGithubProvider(cfg)
            const status = gh.getGithubSetupStatus(process.cwd())
            return {
                ghInstalled: status.ghInstalled,
                ghAuthed: status.ghAuthed,
                ghAuthDetail: status.ghAuthDetail,
                repo: status.repo,
                defaultBranch: status.defaultBranch,
                inGitRepo: Boolean(status.gitRoot),
                workflowExists: status.workflowExists,
                workflowPath: status.workflowPath ? toDisplayPath(status.workflowPath) : undefined,
                provider: plan.provider,
                secretName: plan.secretName,
                providerNote: plan.note,
                secretSet: status.secrets.includes(plan.secretName),
                slackSet: status.secrets.includes(gh.SLACK_SECRET),
                discordSet: status.secrets.includes(gh.DISCORD_SECRET),
                secretsError: status.secretsError,
                savedKeyAvailable: Boolean(plan.savedKey),
            }
        },
        onGithubSetupAction: async (action) => {
            const gh = await import('./utils/github-setup')
            const cfg = await loadConfig()
            const plan = gh.resolveGithubProvider(cfg)
            const status = gh.getGithubSetupStatus(process.cwd())
            if (!status.gitRoot) throw new Error('This folder is not a git repository.')
            if (action.type === 'write-workflow') {
                gh.writeDecemberWorkflow({
                    gitRoot: status.gitRoot,
                    provider: plan.provider,
                    secretName: plan.secretName,
                    baseBranch: status.defaultBranch,
                    overwrite: action.overwrite,
                })
                return `Wrote ${gh.WORKFLOW_RELATIVE_PATH}. Commit and push it to turn the action on.`
            }
            if (action.type === 'use-saved-key') {
                if (!plan.savedKey) throw new Error('No saved API key for this provider.')
                gh.setGithubSecret(status.gitRoot, plan.secretName, plan.savedKey)
                return `Set ${plan.secretName} from your saved ${plan.provider} key.`
            }
            gh.setGithubSecret(status.gitRoot, action.name, action.value)
            return `Set ${action.name}.`
        },
        keybindingsPath: path.join(getConfigDir(), 'keybindings.json'),
        onLoadHooks: async () => {
            const { parseUserHooksFile } = await import('@december/shared')
            const { getUserHookPaths } = await import('./utils/user-hooks-setup')
            const { toDisplayPath } = await import('./utils/doctor-checks')
            const paths = getUserHookPaths(process.cwd())
            const global = parseUserHooksFile(paths.globalPath, 'global')
            const project = parseUserHooksFile(paths.projectPath, 'project')
            const projectSkipped = Boolean(userHooks?.projectHooksSkipped())
            const label = (file: string) => toDisplayPath(file)
            return {
                hooks: [...global.hooks, ...(projectSkipped ? [] : project.hooks)],
                globalPath: label(paths.globalPath),
                projectPath: label(paths.projectPath),
                globalFile: paths.globalPath,
                projectFile: paths.projectPath,
                projectSkipped: projectSkipped && project.hooks.length > 0,
                problems: [
                    ...global.problems.map((p) => `${label(paths.globalPath)}: ${p}`),
                    ...project.problems.map((p) => `${label(paths.projectPath)}: ${p}`),
                ],
            }
        },
        onCompact: async (focus?: string) => {
            const result = await agent.compact({
                focus,
                onStatus: (status) => differentialApp.setStatusMessage(status),
            })
            return {
                compacted: result.compacted,
                tokensBefore: result.tokensBefore,
                tokensAfter: result.tokensAfter,
            }
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
            const { DEFAULT_AGENTS_MD_TEMPLATE } = await import('@december/shared')

            // Create the file at the git root (or the workspace when there is no repo),
            // where the rules lookup finds it from any subfolder
            const { findRuleRoot } = await import('./utils/learn-target')
            const targetDir = findRuleRoot(targetWorkspaceDir)

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

    const { setupUserHooks } = await import('./utils/user-hooks-setup')
    userHooks = await setupUserHooks(agent, {
        workspaceDir: process.cwd(),
        onNotice: (message, tone) => differentialApp.showToast(message, tone),
    })
    void userHooks.runSessionStart(isResumeFlag || isExplicitResumeCmd ? 'resume' : 'startup')

    // output arrives in many small chunks: sync the task list at most every 100ms
    let syncTasksTimer: ReturnType<typeof setTimeout> | null = null
    const syncTasks = () => {
        if (syncTasksTimer) return
        syncTasksTimer = setTimeout(() => {
            syncTasksTimer = null
            differentialApp.updateTasks(mapBackgroundTasksToTaskItems(taskManager.getTasks()))
        }, 100)
    }
    taskManager.on('change', syncTasks)

    const { attachTaskNotifications } = await import('./task-notifications')
    const detachTaskNotifications = attachTaskNotifications(taskManager, {
        steer: (text) => agent.steer({ role: 'user', content: text }),
        notice: (text, tone) => differentialApp.appendTaskNotice(text, tone),
    })

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
        detachTaskNotifications()
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

    /**
     * Start the updated December in this terminal, resuming the current session, and
     * keep this process only as a waiting parent. Spawning (not exec) works on every
     * platform; the parent forwards termination and exits with the child's code.
     */
    const restartIntoUpdatedVersion = async () => {
        const runningTasks = taskManager.getTasks().filter((t) => t.status === 'running')
        if (runningTasks.length > 0) {
            differentialApp.showToast(
                `${runningTasks.length} background task(s) still running. Stop them in /tasks, then /restart.`,
                'info'
            )
            return
        }

        const { spawn } = await import('node:child_process')
        await agent.saveContext().catch(() => {
            // Intentionally swallowed: the new process reloads whatever was saved last
        })
        taskManager.off('change', syncTasks)
        detachTaskNotifications()
        await mcpClientManager.disconnectAll().catch(() => {
            // Intentionally swallowed: MCP servers are restarted by the new process
        })

        differentialApp.handOffTerminal()
        process.off('SIGINT', handleExit)
        process.off('SIGTERM', handleExit)

        const childArgs = [process.argv[1] ?? 'december', '--resume']
        if (agent.sessionId) {
            childArgs.push('--session-id', agent.sessionId)
        }
        const child = spawn(process.execPath, childArgs, {
            stdio: 'inherit',
            cwd: process.cwd(),
            env: process.env,
        })

        // The child owns the terminal now. Ctrl+C reaches it directly, so the parent
        // must not exit early and drop the user back to the shell mid-session.
        process.on('SIGINT', () => {
            // Intentionally ignored: the child handles interrupts
        })
        const forward = (signal: NodeJS.Signals) => () => {
            child.kill(signal)
        }
        process.on('SIGTERM', forward('SIGTERM'))
        process.on('SIGHUP', forward('SIGHUP'))

        // ChildProcess event typings conflict between bun-types and @types/node here
        const childEvents = child as unknown as NodeJS.EventEmitter
        childEvents.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
            process.exit(code ?? (signal ? 1 : 0))
        })
        childEvents.on('error', (err: Error) => {
            process.stderr.write(
                `\nCould not restart December: ${err.message}\nRun "december --resume" to continue your session.\n`
            )
            process.exit(1)
        })
    }

    if (targetSessionId) {
        await agent.loadContext().catch(() => {
            // Intentionally swallowed: ignore context load errors on fresh sessions
        })
        differentialApp.state.messages = convertAgentMessagesToDifferentialMessages(
            agent.messages || []
        )
        differentialApp.setSessionTitle(agent.sessionTitle)
    } else {
        // Non-blocking session context loading during TUI mounting for fresh sessions
        agent.loadContext().catch(() => {
            // Intentionally swallowed: ignore context load errors on fresh sessions
        })
    }

    if (unmatchedSessionRef) {
        shouldOpenSessionMenuOnBoot = true
        differentialApp.state.sessionSearchQuery = unmatchedSessionRef
        differentialApp.showToast(`No session matches "${unmatchedSessionRef}".`, 'info')
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

    // G1: a stale model list is read again in the background while the user types
    void refreshActiveModels()

    // Opens the provider connection while the user types the first prompt
    if (providerConfig) {
        const { warmProviderConnection } = await import('./utils/provider-warmup')
        warmProviderConnection(agent.llm)
    }
}

main().catch(console.error)
