import { describe, expect, it } from 'bun:test'

import { handleDoctorCommand } from '../../src/commands'

describe('CLI Commands & Workflows (Integration)', () => {
    it('executes handleDoctorCommand and inspects environment without errors', async () => {
        let loggedOutput = ''
        const originalLog = console.log
        console.log = (...args: any[]) => {
            loggedOutput += args.join(' ') + '\n'
        }

        try {
            await handleDoctorCommand()
            expect(loggedOutput).toContain('Environment & Runtime')
        } finally {
            console.log = originalLog
        }
    })
})
