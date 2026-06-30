import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { Tool } from '@december/agent'

const execAsync = promisify(exec)

export interface BashInput {
    command: string
}

export const BashTool: Tool<BashInput> = {
    name: 'bash',
    description:
        'Executes a bash command in the current environment and returns the stdout and stderr.',
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The bash command to run.' },
        },
        required: ['command'],
    },
    execute: async ({ command }) => {
        try {
            const { stdout, stderr } = await execAsync(command)
            let output = ''
            if (stdout) output += `STDOUT:\n${stdout}\n`
            if (stderr) output += `STDERR:\n${stderr}\n`
            return output || 'Command executed successfully with no output.'
        } catch (error: any) {
            return `Command failed with error code ${error.code}:\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}\nMESSAGE:\n${error.message}`
        }
    },
}
