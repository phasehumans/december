import './env'
import { Agent } from '@december/agent'
import { publishEvent } from '@december/shared'
import { Worker, Job, Queue } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@december/database'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
})

console.log("Worker started, waiting for jobs on 'agent_jobs'...")

const sessionTimers = new Map<string, NodeJS.Timeout>()
const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

async function handleIdleTimeout(sessionId: string) {
    console.log(
        `[Worker] Session ${sessionId} has been idle for 15 minutes. Triggering backup and shutdown.`
    )
    try {
        await prisma.session.update({
            where: { id: sessionId },
            data: { vmStatus: 'STOPPED' },
        })
        const minioWipeQueue = new Queue('minio_wipe', { connection: redisConnection })
        // In reality, we'd have a backup_workspace job, but we'll queue minio_wipe for now as a placeholder
        // or a new queue for backing up
        const backupQueue = new Queue('backup_workspace', { connection: redisConnection })
        await backupQueue.add('backup', { sessionId })
    } catch (e) {
        console.error(`[Worker] Failed to handle idle timeout for ${sessionId}`, e)
    } finally {
        sessionTimers.delete(sessionId)
    }
}

function resetIdleTimer(sessionId: string) {
    if (sessionTimers.has(sessionId)) {
        clearTimeout(sessionTimers.get(sessionId)!)
    }
    sessionTimers.set(
        sessionId,
        setTimeout(() => handleIdleTimeout(sessionId), IDLE_TIMEOUT_MS)
    )
}

const worker = new Worker(
    'agent_jobs',
    async (job: Job) => {
        const { prompt, projectId, sessionId, userId, secrets } = job.data
        console.log(`Processing job ${job.id} for session ${sessionId}`)

        try {
            const sessionStartTime = Date.now()

            // Call gRPC Runtime to boot VM
            const { createVM } = require('./runtime')
            console.log(`Booting Firecracker VM for session ${sessionId}...`)
            await createVM(sessionId) // TODO: pass workspaceUrl if handoff

            // Send starting event
            await publishEvent(`session_events:${sessionId}`, {
                type: 'connected',
                data: { ok: true },
            })

            const { RemotePlatformAdapter } = require('./remote-operations')
            const { AgentHarness } = require('@december/agent')
            const { runAgentLoop } = require('@december/agent')
            const {
                BashTool,
                ReadFileTool,
                WriteFileTool,
                LsTool,
                EditFileTool,
                EditDiffTool,
                FindFilesTool,
                GrepSearchTool,
                SubagentTool,
                ManageTaskTool,
                BrowserTool,
                GithubTool,
            } = require('@december/tools')
            const { AnthropicProvider } = require('@december/providers')

            const operations = new RemotePlatformAdapter(sessionId)
            const llm = new AnthropicProvider({
                apiKey: process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '',
            })

            const tools = [
                new BashTool(),
                new ReadFileTool(),
                new WriteFileTool(),
                new LsTool(),
                new EditFileTool(),
                new EditDiffTool(),
                new FindFilesTool(),
                new GrepSearchTool(),
                new SubagentTool(),
                new ManageTaskTool(),
                new BrowserTool(),
                new GithubTool(),
            ]

            const harness = new AgentHarness({
                baseSystemPrompt:
                    'You are December, an autonomous software engineer. You have access to tools. When executing code, please use JSON schemas for tool inputs. Before using a tool, you MUST enclose your thought process inside <thought>...</thought> tags. At the end of your work, provide a summary of what you did, highlighting important keywords.',
                llm,
                tools,
                operations,
                sessionId,
                workspaceDir: '/root',
            })
            const agent = harness.getAgent()

            if (secrets) {
                for (const secret of secrets) {
                    agent.env.set(secret.name, secret.value)
                }
            }

            // Subscribe to interrupts (Phase 4.4 Agent Interruption)
            const interruptSubscriber = redisConnection.duplicate()
            await interruptSubscriber.subscribe(`session_interrupts:${sessionId}`)
            interruptSubscriber.on('message', (channel, message) => {
                if (channel === `session_interrupts:${sessionId}`) {
                    const evt = JSON.parse(message)
                    if (evt.type === 'INTERRUPT') {
                        console.log(
                            `[Worker] Interruption received for session ${sessionId}, aborting agent...`
                        )
                        agent.abort()
                    }
                }
            })

            let sessionUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            let userCredits = await prisma.user.findUnique({
                where: { id: userId },
                select: { creditBalance: true },
            })

            const stream = runAgentLoop(agent, prompt)
            for await (const event of stream) {
                resetIdleTimer(sessionId)
                if (event.type === 'AgentUsage') {
                    sessionUsage.inputTokens += event.data?.inputTokens || 0
                    sessionUsage.outputTokens += event.data?.outputTokens || 0
                    sessionUsage.totalTokens += event.data?.totalTokens || 0

                    // Cache in Redis
                    await redisConnection.hset(`session_usage:${sessionId}`, sessionUsage)

                    // Calculate session duration markup (Phase 5.3 Compute Abuse)
                    const sessionDurationSeconds = (Date.now() - sessionStartTime) / 1000
                    const computeCostMarkup = sessionDurationSeconds * 0.0005 // Arbitrary 0.05 cents per second compute fee

                    // Estimate cost roughly (assuming 1 cent per 1k tokens + compute markup)
                    // We will sync actual usage to a BullMQ job for the Server to handle exact cost deduction later
                    const tokenCost = Math.ceil(sessionUsage.totalTokens / 1000)
                    const estimatedCost = tokenCost + computeCostMarkup

                    if (userCredits && userCredits.creditBalance - estimatedCost <= 0) {
                        await publishEvent(`session_events:${sessionId}`, {
                            type: 'LOW_BALANCE',
                            data: { message: 'Out of credits. Terminating.' },
                        })
                        // Hard stop
                        throw new Error('Zero balance hard stop triggered')
                    }
                }

                await publishEvent(`session_events:${sessionId}`, event)
            }

            resetIdleTimer(sessionId)

            // Clean up interrupt subscriber
            await interruptSubscriber.unsubscribe(`session_interrupts:${sessionId}`)
            interruptSubscriber.quit()

            // Stream ended, dispatch sync job to a usage_sync queue so Server can accurately bill and save to DB
            const sessionDurationSeconds = (Date.now() - sessionStartTime) / 1000
            const computeCostMarkup = sessionDurationSeconds * 0.0005

            const usageSyncQueue = new Queue('usage_sync', { connection: redisConnection })
            await usageSyncQueue.add('sync', {
                userId,
                projectId,
                sessionId,
                model: 'auto', // default
                computeCostMarkup,
                durationSeconds: sessionDurationSeconds,
                ...sessionUsage,
            })

            await publishEvent(`session_events:${sessionId}`, { type: 'done' })
        } catch (error: any) {
            console.error(`Error in job ${job.id}:`, error)
            await publishEvent(`session_events:${sessionId}`, {
                type: 'error',
                data: { message: error.message },
            })
            throw error
        }
    },
    { connection: redisConnection }
)

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error ${err.message}`)
})
