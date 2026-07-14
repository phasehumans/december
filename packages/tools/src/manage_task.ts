import { Tool, truncateOutput, ToolExecuteContext } from '@december/shared'

export interface ManageTaskInput {
    action: 'status' | 'kill'
    taskId: string
}

export const ManageTaskTool: Tool<ManageTaskInput> = {
    name: 'manage_task',
    description:
        'Use this tool to check the status or kill a background task that was started by the bash tool.',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['status', 'kill'],
                description: 'The action to perform on the background task.',
            },
            taskId: {
                type: 'string',
                description: 'The ID of the task to manage.',
            },
        },
        required: ['action', 'taskId'],
    },
    execute: async ({ action, taskId }, context: ToolExecuteContext) => {
        if (action === 'status') {
            if (!context.operations.bash.getTaskStatus) {
                return 'Error: Task management is not supported in the current environment.'
            }
            try {
                const { status, output } = await context.operations.bash.getTaskStatus(taskId)
                const formattedOutput = truncateOutput(output).text
                return `Task [${taskId}] is currently: ${status}\n\nRecent Output:\n${formattedOutput}`
            } catch (err: any) {
                return `Error: ${err.message}`
            }
        } else if (action === 'kill') {
            if (!context.operations.bash.killTask) {
                return 'Error: Task management is not supported in the current environment.'
            }
            try {
                const killed = await context.operations.bash.killTask(taskId)
                if (killed) {
                    return `Successfully killed task [${taskId}].`
                } else {
                    return `Task [${taskId}] is either not running or could not be killed.`
                }
            } catch (err: any) {
                return `Error: ${err.message}`
            }
        }

        return 'Invalid action.'
    },
}
