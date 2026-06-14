import { Command } from 'commander'
import { renderTUI } from './tui/App'

const program = new Command()

program.name('december').description('Model-agnostic terminal coding agent').version('0.1.0')

program
    .command('chat')
    .description('Start interactive coding agent session in terminal')
    .option('-m, --model <model>', 'LLM model to use', 'gemini')
    .action((options) => {
        renderTUI({ model: options.model })
    })

program.parse(process.argv)
