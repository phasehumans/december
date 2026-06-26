import { describe, expect, test } from 'bun:test'
import {
    syncEnvVarsSchema,
    createGithubRepoSchema,
    syncGithubRepoSchema,
} from '../../src/modules/platform/platform.schema'
import { buildProjectZip } from '../../src/modules/platform/platform.utils'

describe('platform.schemas', () => {
    describe('syncEnvVarsSchema', () => {
        test('should validate valid keys array with strings', () => {
            const res = syncEnvVarsSchema.safeParse({ keys: ['API_KEY', 'DATABASE_URL'] })
            expect(res.success).toBe(true)
        })

        test('should validate missing keys array (optional)', () => {
            const res = syncEnvVarsSchema.safeParse({})
            expect(res.success).toBe(true)
        })

        test('should reject keys array containing non-string values', () => {
            const res = syncEnvVarsSchema.safeParse({ keys: [123, true] })
            expect(res.success).toBe(false)
        })
    })

    describe('createGithubRepoSchema', () => {
        test('should validate valid repo name and private flag', () => {
            const res = createGithubRepoSchema.safeParse({
                name: 'valid-repo_name.1',
                private: false,
                description: 'A test repository',
            })
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.name).toBe('valid-repo_name.1')
                expect(res.data.private).toBe(false)
                expect(res.data.description).toBe('A test repository')
            }
        })

        test('should apply default private=true if omitted', () => {
            const res = createGithubRepoSchema.safeParse({ name: 'my-repo' })
            expect(res.success).toBe(true)
            if (res.success) {
                expect(res.data.private).toBe(true)
            }
        })

        test('should reject empty repo name', () => {
            const res = createGithubRepoSchema.safeParse({ name: '' })
            expect(res.success).toBe(false)
        })

        test('should reject repo name exceeding 100 characters', () => {
            const res = createGithubRepoSchema.safeParse({ name: 'a'.repeat(101) })
            expect(res.success).toBe(false)
        })

        test('should reject repo name with spaces or special characters', () => {
            const res1 = createGithubRepoSchema.safeParse({ name: 'my repo' })
            const res2 = createGithubRepoSchema.safeParse({ name: 'my@repo!' })
            expect(res1.success).toBe(false)
            expect(res2.success).toBe(false)
        })

        test('should reject non-boolean private flag', () => {
            const res = createGithubRepoSchema.safeParse({ name: 'my-repo', private: 'true' })
            expect(res.success).toBe(false)
        })
    })

    describe('syncGithubRepoSchema', () => {
        test('should validate valid commitMessage', () => {
            const res = syncGithubRepoSchema.safeParse({ commitMessage: 'Initial commit' })
            expect(res.success).toBe(true)
        })

        test('should validate missing commitMessage (optional)', () => {
            const res = syncGithubRepoSchema.safeParse({})
            expect(res.success).toBe(true)
        })

        test('should reject empty commitMessage string', () => {
            const res = syncGithubRepoSchema.safeParse({ commitMessage: '' })
            expect(res.success).toBe(false)
        })

        test('should reject non-string commitMessage', () => {
            const res = syncGithubRepoSchema.safeParse({ commitMessage: 123 })
            expect(res.success).toBe(false)
        })
    })
})

describe('platform.utils', () => {
    describe('buildProjectZip', () => {
        test('should successfully compile multiple file entries into a valid ZIP buffer structure', () => {
            const entries = [
                { path: 'index.html', content: '<!DOCTYPE html><html><body>Hello</body></html>' },
                { path: 'src/App.tsx', content: 'export const App = () => <div>App</div>' },
            ]
            const buffer = buildProjectZip(entries)
            expect(buffer).toBeInstanceOf(Uint8Array)
            expect(buffer.length).toBeGreaterThan(0)

            // Local file header signature: PK\x03\x04
            expect(buffer[0]).toBe(0x50) // P
            expect(buffer[1]).toBe(0x4b) // K
            expect(buffer[2]).toBe(0x03) // \x03
            expect(buffer[3]).toBe(0x04) // \x04
        })

        test('should handle empty entries array correctly', () => {
            const buffer = buildProjectZip([])
            expect(buffer).toBeInstanceOf(Uint8Array)
            expect(buffer.length).toBe(22) // End of central directory record length is 22 bytes

            // End of central directory signature: PK\x05\x06
            expect(buffer[0]).toBe(0x50)
            expect(buffer[1]).toBe(0x4b)
            expect(buffer[2]).toBe(0x05)
            expect(buffer[3]).toBe(0x06)
        })

        test('should normalize backslashes in file paths to forward slashes', () => {
            const entries = [
                {
                    path: 'src\\components\\Button.tsx',
                    content: 'export const Button = () => <button/>',
                },
            ]
            const buffer = buildProjectZip(entries)
            const decoder = new TextDecoder()
            const zipContentString = decoder.decode(buffer)
            expect(zipContentString).toContain('src/components/Button.tsx')
            expect(zipContentString).not.toContain('src\\components\\Button.tsx')
        })

        test('should correctly process entries with empty content strings', () => {
            const entries = [{ path: 'empty.txt', content: '' }]
            const buffer = buildProjectZip(entries)
            expect(buffer).toBeInstanceOf(Uint8Array)
            expect(buffer.length).toBeGreaterThan(22)
            expect(buffer[0]).toBe(0x50)
            expect(buffer[1]).toBe(0x4b)
        })
    })
})
