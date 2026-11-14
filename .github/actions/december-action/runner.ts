import { runDecemberAction } from '../../../packages/december-action/src/action-runner'

runDecemberAction({})
    .then((result) => {
        if (!result.success) {
            console.error(`[December Action Error] ${result.error || 'Execution failed'}`)
            process.exit(1)
        }
        console.log(`[December Action Success] Status: ${result.status}`)
        process.exit(0)
    })
    .catch((err) => {
        console.error('[December Action Fatal]', err)
        process.exit(1)
    })
