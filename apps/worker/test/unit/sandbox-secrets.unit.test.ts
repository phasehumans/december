import { describe, it, expect } from 'bun:test'

import {
    SECRETS_FILE,
    applySecretsToSandbox,
    buildSecretsFile,
    secretEnvsOf,
    toSecretEnvs,
} from '../../src/sandbox-secrets'

describe('sandbox secrets', () => {
    describe('toSecretEnvs', () => {
        it('maps the secrets of the job to environment values', () => {
            expect(
                toSecretEnvs([
                    { key: 'API_URL', value: 'https://web.test' },
                    { key: '_TOKEN2', value: 'abc' },
                ])
            ).toEqual({ API_URL: 'https://web.test', _TOKEN2: 'abc' })
        })

        it('drops a name that is not an environment name, and an empty value', () => {
            expect(
                toSecretEnvs([
                    { key: 'GOOD', value: 'yes' },
                    { key: '1BAD', value: 'x' },
                    { key: 'BAD NAME', value: 'x' },
                    { key: 'BAD;rm -rf /', value: 'x' },
                    { key: 'EMPTY', value: '' },
                    { key: '', value: 'x' },
                ])
            ).toEqual({ GOOD: 'yes' })
        })

        it('drops a system name of the sandbox, so a secret never changes PATH or the loader', () => {
            expect(
                toSecretEnvs([
                    { key: 'PATH', value: '/tmp/evil' },
                    { key: 'LD_PRELOAD', value: '/tmp/evil.so' },
                    { key: 'BASH_ENV', value: '/tmp/x' },
                    { key: 'DECEMBER_RUN', value: 'x' },
                    { key: 'E2B_API_KEY', value: 'x' },
                    { key: 'GIT_SSH_COMMAND', value: 'x' },
                    { key: 'GITHUB_TOKEN', value: 'ghp_ok' },
                ])
            ).toEqual({ GITHUB_TOKEN: 'ghp_ok' })
        })

        it('gives nothing for no secrets', () => {
            expect(toSecretEnvs(undefined)).toEqual({})
            expect(toSecretEnvs([])).toEqual({})
        })
    })

    describe('buildSecretsFile', () => {
        it('writes one export line for each secret', () => {
            expect(buildSecretsFile({ API_URL: 'https://web.test', REGION: 'eu' })).toBe(
                "export API_URL='https://web.test'\nexport REGION='eu'\n"
            )
        })

        it('keeps a value with shell characters as plain text', () => {
            expect(buildSecretsFile({ KEY: 'a$b`c"d\\e' })).toBe("export KEY='a$b`c\"d\\e'\n")
            expect(buildSecretsFile({ KEY: "it's" })).toBe("export KEY='it'\\''s'\n")
        })

        it('is empty for no secrets', () => {
            expect(buildSecretsFile({})).toBe('')
        })
    })

    describe('applySecretsToSandbox', () => {
        const fakeSandbox = () => {
            const writes: Array<{ path: string; content: string }> = []
            const commands: string[] = []
            const sandbox = {
                files: {
                    write: async (path: string, content: string) => {
                        writes.push({ path, content })
                    },
                },
                commands: {
                    run: async (command: string) => {
                        commands.push(command)
                        return { exitCode: 0 }
                    },
                },
            }
            return { sandbox, writes, commands }
        }

        it('writes the values of this run again, so a changed secret replaces the old one', async () => {
            const { sandbox, writes } = fakeSandbox()
            await applySecretsToSandbox({ sandbox, secrets: [{ key: 'API_URL', value: 'old' }] })
            await applySecretsToSandbox({ sandbox, secrets: [{ key: 'API_URL', value: 'new' }] })

            expect(writes).toEqual([
                { path: SECRETS_FILE, content: "export API_URL='old'\n" },
                { path: SECRETS_FILE, content: "export API_URL='new'\n" },
            ])
            expect(secretEnvsOf(sandbox)).toEqual({ API_URL: 'new' })
        })

        it('never puts a value in a command or in a log', async () => {
            const { sandbox, commands } = fakeSandbox()
            const printed: string[] = []
            const saved = { log: console.log, warn: console.warn, error: console.error }
            const capture = (...args: unknown[]) => {
                printed.push(args.map(String).join(' '))
            }
            console.log = capture
            console.warn = capture
            console.error = capture
            try {
                await applySecretsToSandbox({
                    sandbox,
                    secrets: [{ key: 'TOKEN', value: 'very-secret-value' }],
                })
                // a sandbox that fails must not print the value too
                await applySecretsToSandbox({
                    sandbox: {
                        files: {
                            write: async () => {
                                throw new Error('disk full')
                            },
                        },
                        commands: sandbox.commands,
                    },
                    secrets: [{ key: 'TOKEN', value: 'very-secret-value' }],
                })
            } finally {
                Object.assign(console, saved)
            }

            expect(commands.length).toBeGreaterThan(0)
            expect(commands.join('\n')).not.toContain('very-secret-value')
            expect(commands.join('\n')).toContain(SECRETS_FILE)
            expect(printed.join('\n')).not.toContain('very-secret-value')
        })

        it('clears the file when the run has no secrets', async () => {
            const { sandbox, writes } = fakeSandbox()
            await applySecretsToSandbox({ sandbox, secrets: [{ key: 'A', value: '1' }] })
            await applySecretsToSandbox({ sandbox, secrets: [] })
            expect(writes[1]).toEqual({ path: SECRETS_FILE, content: '' })
            expect(secretEnvsOf(sandbox)).toBeUndefined()
        })

        it('does nothing on a sandbox with no file api (a mock sandbox)', async () => {
            const applied = await applySecretsToSandbox({
                sandbox: { sandboxId: 'mock-sandbox-1', isMock: true },
                secrets: [{ key: 'A', value: '1' }],
            })
            expect(applied).toBe(false)
        })
    })
})
