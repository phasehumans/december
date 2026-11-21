import { describe, expect, test } from 'bun:test'

import { formatUpdateNotice } from '../src/commands/update'

import type { UpdateResult } from '../src/utils/updater'

const base: UpdateResult = {
    success: true,
    method: 'npm',
    command: 'npm install -g @trydecember/cli@0.4.19',
    manualCmd: 'npm install -g @trydecember/cli@0.4.19',
    currentVersion: '0.4.18',
    targetVersion: '0.4.19',
    verified: true,
}

describe('formatUpdateNotice', () => {
    test('asks for a restart only after a verified install', () => {
        const notice = formatUpdateNotice({ ...base, installedVersion: '0.4.19' })
        expect(notice.variant).toBe('success')
        expect(notice.toast).toContain('Press Enter to restart')
        expect(notice.message?.content).toContain('/restart')
    })

    test('does not mention a restart when already up to date', () => {
        const notice = formatUpdateNotice({
            ...base,
            alreadyUpToDate: true,
            installedVersion: '0.4.19',
        })
        expect(notice.toast.toLowerCase()).not.toContain('restart')
        expect(notice.message).toBeUndefined()
    })

    test('explains failures with a command to run', () => {
        const notice = formatUpdateNotice({
            ...base,
            success: false,
            verified: false,
            error: 'boom',
        })
        expect(notice.variant).toBe('error')
        expect(notice.message?.hint).toContain('npm install -g @trydecember/cli@0.4.19')
    })

    test('shows the permission hint instead of sudo when one exists', () => {
        const notice = formatUpdateNotice({
            ...base,
            success: false,
            verified: false,
            isPermissionError: true,
            permissionHint: 'fix ownership with chown',
        })
        expect(notice.message?.hint).toBe('fix ownership with chown')
    })
})
