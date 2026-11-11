import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { cursorAdapter } from '../src/auth/subscriptions/adapters/cursor'

describe('Cursor Pro Adapter (TDD)', () => {
    let originalEnv: NodeJS.ProcessEnv
    let tempDir: string

    beforeEach(async () => {
        originalEnv = { ...process.env }
        tempDir = path.join(os.tmpdir(), `december-cursor-test-${Date.now()}-${Math.random()}`)
        await fs.mkdir(tempDir, { recursive: true })
        process.env.HOME = tempDir
        delete process.env.CURSOR_TOKEN
        delete process.env.CURSOR_AUTH_TOKEN
        delete process.env.CURSOR_API_KEY
    })

    afterEach(async () => {
        process.env = originalEnv
        vi.restoreAllMocks()
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup
        }
    })

    describe('Seam 1: Local Credential Detection', () => {
        it('detects credentials from ~/.cursor/auth.json', async () => {
            const cursorConfigDir = path.join(tempDir, '.cursor')
            await fs.mkdir(cursorConfigDir, { recursive: true })

            const mockAuth = {
                accessToken: 'cursor-jwt-token-abc-123',
                refreshToken: 'cursor-refresh-token-456',
                email: 'user@cursor.sh',
                membershipType: 'pro',
            }
            await fs.writeFile(
                path.join(cursorConfigDir, 'auth.json'),
                JSON.stringify(mockAuth),
                'utf-8'
            )

            const detected = await cursorAdapter.detectLocal()

            expect(detected).not.toBeNull()
            expect(detected?.provider).toBe('cursor')
            expect(detected?.accessToken).toBe('cursor-jwt-token-abc-123')
            expect(detected?.refreshToken).toBe('cursor-refresh-token-456')
            expect(detected?.email).toBe('user@cursor.sh')
            expect(detected?.subscriptionType).toBe('cursor_pro')
            expect(detected?.source).toBe('local_import')
        })

        it('detects credentials from CURSOR_TOKEN environment variable', async () => {
            process.env.CURSOR_TOKEN = 'cursor-env-token-999'

            const detected = await cursorAdapter.detectLocal()

            expect(detected).not.toBeNull()
            expect(detected?.provider).toBe('cursor')
            expect(detected?.accessToken).toBe('cursor-env-token-999')
            expect(detected?.subscriptionType).toBe('cursor_pro')
            expect(detected?.source).toBe('env')
        })

        it('returns null when no Cursor credentials exist', async () => {
            const detected = await cursorAdapter.detectLocal()
            expect(detected).toBeNull()
        })
    })

    describe('Seam 2: Token Verification & Status', () => {
        it('verifies valid bundle with accessToken', async () => {
            const bundle = {
                provider: 'cursor',
                accessToken: 'cursor-active-token',
                expiresAt: Date.now() + 3600 * 1000,
            }

            const isValid = await cursorAdapter.verifyToken!(bundle)
            expect(isValid).toBe(true)
        })

        it('rejects expired bundle without refreshToken', async () => {
            const bundle = {
                provider: 'cursor',
                accessToken: 'cursor-expired-token',
                expiresAt: Date.now() - 5000,
            }

            const isValid = await cursorAdapter.verifyToken!(bundle)
            expect(isValid).toBe(false)
        })
    })
})
