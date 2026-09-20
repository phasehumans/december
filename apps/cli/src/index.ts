#!/usr/bin/env node

import path from 'node:path'

import pkg from '../package.json' with { type: 'json' }

import { parseCliArgs, getHelpText } from './args'
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
} from './commands'
export { runHeadlessTask, suppressConsole, restoreConsole } from './headless-runner'
export type { HeadlessTaskOptions, HeadlessTaskResult } from './headless-runner'

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
    process.stdout.write('\x1b]0;december\x07')

    const parsedArgs = parseCliArgs(process.argv.slice(2))

    // Fast-path 1: Help flag (< 5ms)
    if (parsedArgs.isHelp) {
        console.log(getHelpText(pkg.version))
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
        const targetProvider = parsedArgs.positionals[1]
        const { handleLoginCommand } = await import('./commands')
        await handleLoginCommand({ provider: targetProvider })
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

    if (parsedArgs.command === 'docs') {
        const section = parsedArgs.positionals[1]
        const { handleDocsCommand } = await import('./commands')
        await handleDocsCommand({ section })
        process.exit(0)
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

    // Path 4: Headless Task Execution (Load agent harness & tools, skip Ink/React/TUI)
    if (parsedArgs.prompt) {
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

        const harness = new AgentHarness({
            llm: llm,
            tools: effectiveTools,
            deferredTools,
            operations: localOperations,
            modelOptions: {
                model: initialModel,
                thinkingLevel: config.thinkingLevel || 'auto',
            },
            sessionRepository,
            sessionId,
            runtime: 'cli',
            workspaceDir: parsedArgs.scope
                ? path.resolve(process.cwd(), parsedArgs.scope)
                : process.cwd(),
            thinkingLevel: config.thinkingLevel || 'auto',
            steeringMode: config.steeringMode || 'all',
            followUpMode: config.followUpMode || 'all',
        })

        const agent = harness.getAgent()
        await agent.loadContext()

        if (!parsedArgs.json) {
            console.log(
                isAskMode
                    ? `\nExecuting Ask Q&A: "${parsedArgs.prompt}"\n`
                    : `\nExecuting Headless Task: "${parsedArgs.prompt}"\n`
            )
        }

        const effectivePrompt = isAskMode ? getAskPrompt(parsedArgs.prompt) : parsedArgs.prompt

        const result = await runHeadlessTask(effectivePrompt, {
            agent,
            nonInteractive: parsedArgs.yes,
            json: parsedArgs.json,
            readOnly: isAskMode,
        })
        process.exit(result.success ? 0 : 1)
    }

    // Path 5: Full Interactive TUI Session (Lazy load Ink, React, and TUI modules)
    const [
        { AgentHarness },
        { openaiProvider },
        toolsModule,
        tuiModule,
        inkModule,
        reactModule,
        { FileSessionRepository },
        { getProviderConfig, loadConfig, getAuthStatus },
        { suppressConsole },
        { useAgentSession },
        { localOperations, setActiveScopeDir },
        { instantiateProvider },
        { ensureValidModelForProvider },
        { useCliStore },
    ] = await Promise.all([
        import('@december/agent'),
        import('@december/providers'),
        import('@december/tools'),
        import('@december/tui'),
        import('ink'),
        import('react'),
        import('./file-session-repository'),
        import('./config'),
        import('./headless-runner'),
        import('./hooks/use-agent-session'),
        import('./local-operations'),
        import('./utils/provider-factory'),
        import('./utils/models'),
        import('./store'),
    ])

    if (parsedArgs.scope) {
        setActiveScopeDir(parsedArgs.scope)
    }

    const React = reactModule.default || reactModule
    const { render } = inkModule
    const { ChatApp: App, RootLayout } = tuiModule

    // Suppress noisy sdk console logs that corrupt the ink tui layout
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
    let targetSessionId = parsedArgs.sessionId
    if (parsedArgs.command === 'resume' || parsedArgs.resume) {
        if (!targetSessionId && parsedArgs.positionals[1]) {
            targetSessionId = parsedArgs.positionals[1]
        }
        if (!targetSessionId) {
            const sessions = await sessionRepository.listSessions()
            if (sessions.length > 0) {
                targetSessionId = sessions[0].id
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

    const harness = new AgentHarness({
        llm: llm,
        tools: toolsModule.CORE_TOOLS,
        deferredTools: toolsModule.DEFERRED_TOOLS,
        operations: localOperations,
        modelOptions: {
            model: initialModel,
            thinkingLevel: config.thinkingLevel || 'auto',
        },
        sessionRepository,
        sessionId,
        runtime: 'cli',
        workspaceDir: parsedArgs.scope
            ? path.resolve(process.cwd(), parsedArgs.scope)
            : process.cwd(),
        thinkingLevel: config.thinkingLevel || 'auto',
        steeringMode: config.steeringMode || 'all',
        followUpMode: config.followUpMode || 'all',
    })

    const agent = harness.getAgent()

    if (targetSessionId) {
        await agent.loadContext().catch(() => {
            // Intentionally swallowed: ignore context load errors on fresh sessions
        })
        const nonSystem = (agent.messages || []).filter((m: any) => m.role !== 'system')
        if (nonSystem.length > 0) {
            const { convertAgentMessagesToTuiMessages } = await import('./hooks/use-agent-runner')
            const resumed = convertAgentMessagesToTuiMessages(agent.messages)
            if (resumed.length > 0) {
                useCliStore
                    .getState()
                    .setStaticMessages([{ id: 'header', role: 'header' }, ...resumed])
            }
        }
    } else {
        // Non-blocking session context loading during TUI mounting for fresh sessions
        agent.loadContext().catch(() => {
            // Intentionally swallowed: ignore context load errors on fresh sessions
        })
    }

    function AppWrapper(props: any) {
        const [latestVersion, setLatestVersion] = React.useState(undefined as string | undefined)
        React.useEffect(() => {
            import('./utils/version-check')
                .then(({ checkForLatestVersion }) => {
                    checkForLatestVersion(pkg.version).then((v) => {
                        if (v) setLatestVersion(v)
                    })
                })
                .catch(() => {})
        }, [])

        const handleUpdateSuccess = React.useCallback(async () => {
            const { clearVersionCheckCache } = await import('./utils/version-check')
            await clearVersionCheckCache()
        }, [])

        const session = useAgentSession(props)
        return React.createElement(App, {
            ...props,
            latestVersion,
            onUpdateSuccess: handleUpdateSuccess,
            session,
        })
    }

    const userEmail = config.decemberToken ? config.email : undefined

    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?2004h')
        const cleanupBracketedPaste = () => {
            try {
                process.stdout.write('\x1b[?2004l')
            } catch {
                // Intentionally swallowed: cleanup bracketed paste on terminal exit
            }
        }
        process.on('exit', cleanupBracketedPaste)
        process.on('SIGINT', cleanupBracketedPaste)
        process.on('SIGTERM', cleanupBracketedPaste)
    }

    render(
        React.createElement(
            RootLayout,
            null,
            React.createElement(AppWrapper, {
                agent,
                isAuthenticated,
                authMethod: providerConfig?.authMethod,
                hasBothAuth: authStatus.hasByok && authStatus.hasDecember,
                settingsAuthPriority: authStatus.authPriority,
                cliVersion: pkg.version,
                userEmail,
                sessionRepository,
                onLogin: (onCode: (code: string, uri: string) => void) =>
                    import('./auth').then(({ loginViaDeviceCode }) =>
                        loginViaDeviceCode(undefined, onCode)
                    ),
            })
        ),
        { exitOnCtrlC: false }
    )
}

main().catch(console.error)
