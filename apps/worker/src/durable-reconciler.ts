import { DurableStepKernel, type DurableStepRecord } from '@december/agent'

import { RemotePlatformAdapter } from './remote-operations'

export interface ReconcileResult {
    reconciled: boolean
    opId?: string
    action?: 'committed_cached' | 'attached_and_committed' | 'none'
    step?: DurableStepRecord
}

/**
 * Reconciles any in-flight or uncommitted tool execution from a previous crashed worker session.
 * Follows the Alan AI specification:
 * - If opId is done -> commit cached result
 * - If opId is running -> attach to output stream, wait for completion, commit result
 * - If opId is unknown -> do nothing (normal execution will proceed)
 */
export async function reconcilePendingOp(
    sessionId: string,
    kernel: DurableStepKernel,
    adapter: RemotePlatformAdapter
): Promise<ReconcileResult> {
    const lastStep = await kernel.getLastStep(sessionId)
    if (!lastStep) {
        return { reconciled: false }
    }

    // Only MODEL_INFERENCE steps can have pending tool executions
    if (lastStep.stepType !== 'MODEL_INFERENCE') {
        return { reconciled: false }
    }

    // Extract tool call and opId from step output or input
    const toolCall = lastStep.output?.toolCall || lastStep.output?.toolCalls?.[0] || lastStep.output
    const opId = lastStep.opId || toolCall?.opId || toolCall?.id

    if (!opId) {
        return { reconciled: false }
    }

    // Query sandbox operation journal status
    const opStatus = await adapter.getOpStatus(opId)

    if (opStatus.status === 'done') {
        console.log(
            `[DURABLE RECONCILER] Session '${sessionId}': Op '${opId}' already completed in sandbox. Committing cached result.`
        )
        const step = await kernel.commitStep({
            sessionId,
            stepType: 'TOOL_EXECUTION',
            opId,
            output: {
                exitCode: opStatus.exitCode ?? 0,
                output: opStatus.output ?? '',
            },
        })
        return {
            reconciled: true,
            opId,
            action: 'committed_cached',
            step,
        }
    }

    if (opStatus.status === 'running') {
        console.log(
            `[DURABLE RECONCILER] Session '${sessionId}': Op '${opId}' is still running in sandbox. Attaching to process...`
        )
        // Poll until done or timeout
        let isDone = false
        let finalStatus = opStatus
        const pollStartTime = Date.now()
        const maxWaitMs = 15000 // 15 second attachment wait

        while (!isDone && Date.now() - pollStartTime < maxWaitMs) {
            await new Promise((r) => setTimeout(r, 200))
            finalStatus = await adapter.getOpStatus(opId)
            if (finalStatus.status === 'done' || finalStatus.status === 'terminated') {
                isDone = true
                break
            }
        }

        const step = await kernel.commitStep({
            sessionId,
            stepType: 'TOOL_EXECUTION',
            opId,
            output: {
                exitCode: finalStatus.exitCode ?? 0,
                output: finalStatus.output ?? '',
            },
        })

        return {
            reconciled: true,
            opId,
            action: 'attached_and_committed',
            step,
        }
    }

    // If status is unknown, no running process was found; let normal execution proceed
    return { reconciled: false, opId, action: 'none' }
}
