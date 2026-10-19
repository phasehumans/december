import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
    MANDATORY_HANDOFF_EXCLUDES,
    getHandoffExcludes,
    scanWorkspaceForHandoff,
    createWorkspaceArchive,
} from '../../src/utils/handoff'

describe('Handoff Secret Redaction and Archiving Utilities (Unit)', () => {
    test('contains mandatory secret blacklist entries including newly added credentials, cloud dirs, and shell histories', () => {
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.env')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.env.*')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('*.pem')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('*.key')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('*.cert')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('id_rsa')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.aws/**')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.ssh/**')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.npmrc')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.december/config.json')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.december/logs')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('node_modules/**')

        // Expanded exclusion patterns
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.git/config')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.netrc')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.docker/config.json')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.kube/config')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.gnupg')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.azure')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.gcp')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.oci')
        expect(MANDATORY_HANDOFF_EXCLUDES).toContain('.*_history')
    })

    test('getHandoffExcludes merges .gitignore and .decemberignore rules with blacklist', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-test-'))
        try {
            fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'coverage/\n# comment\n*.tmp\n')
            fs.writeFileSync(path.join(tmpDir, '.decemberignore'), 'custom_secret.txt\n')

            const excludes = getHandoffExcludes(tmpDir)

            expect(excludes).toContain('.env')
            expect(excludes).toContain('coverage')
            expect(excludes).toContain('*.tmp')
            expect(excludes).toContain('custom_secret.txt')
            expect(excludes.includes('# comment')).toBe(false)
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    test('createWorkspaceArchive creates valid tarball excluding secret files', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-archive-test-'))
        const archivePath = path.join(tmpDir, '.december-handoff.tar.gz')
        const extractDir = path.join(tmpDir, 'extracted')

        try {
            fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'console.log("hello world")')
            fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET_KEY=12345')
            fs.writeFileSync(path.join(tmpDir, '.env.local'), 'LOCAL_KEY=67890')
            fs.writeFileSync(path.join(tmpDir, 'id_rsa'), 'PRIVATE_KEY_DATA')
            fs.writeFileSync(
                path.join(tmpDir, '.netrc'),
                'machine example.com login user password secret'
            )
            fs.writeFileSync(path.join(tmpDir, '.bash_history'), 'git commit -m "secret"')
            fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true })
            fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep.js'), '// dep')

            await createWorkspaceArchive(archivePath, tmpDir)

            expect(fs.existsSync(archivePath)).toBe(true)

            fs.mkdirSync(extractDir, { recursive: true })
            const { execSync } = await import('node:child_process')
            execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`)

            expect(fs.existsSync(path.join(extractDir, 'index.ts'))).toBe(true)
            expect(fs.existsSync(path.join(extractDir, '.env'))).toBe(false)
            expect(fs.existsSync(path.join(extractDir, '.env.local'))).toBe(false)
            expect(fs.existsSync(path.join(extractDir, 'id_rsa'))).toBe(false)
            expect(fs.existsSync(path.join(extractDir, '.netrc'))).toBe(false)
            expect(fs.existsSync(path.join(extractDir, '.bash_history'))).toBe(false)
            expect(fs.existsSync(path.join(extractDir, 'node_modules'))).toBe(false)
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    test('symlink escape prevention: symlinks pointing outside workspace root are omitted from archive', async () => {
        const tmpOuterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-outer-'))
        const tmpWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-ws-'))
        const archivePath = path.join(tmpWorkspaceDir, '.december-handoff.tar.gz')
        const extractDir = path.join(tmpWorkspaceDir, 'extracted')

        try {
            const secretOutsideFile = path.join(tmpOuterDir, 'host_secret.txt')
            fs.writeFileSync(secretOutsideFile, 'SUPER_SECRET_HOST_CONTENT')

            fs.writeFileSync(path.join(tmpWorkspaceDir, 'safe_file.txt'), 'safe content')
            // Symlink pointing outside workspace
            fs.symlinkSync(secretOutsideFile, path.join(tmpWorkspaceDir, 'escaped_link.txt'))

            // Safe internal symlink pointing inside workspace
            fs.symlinkSync(
                path.join(tmpWorkspaceDir, 'safe_file.txt'),
                path.join(tmpWorkspaceDir, 'internal_link.txt')
            )

            const scanResult = await createWorkspaceArchive(archivePath, tmpWorkspaceDir)

            expect(scanResult.outsideSymlinks).toContain('escaped_link.txt')
            expect(scanResult.outsideSymlinks).not.toContain('internal_link.txt')

            fs.mkdirSync(extractDir, { recursive: true })
            const { execSync } = await import('node:child_process')
            execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`)

            expect(fs.existsSync(path.join(extractDir, 'safe_file.txt'))).toBe(true)
            expect(fs.existsSync(path.join(extractDir, 'escaped_link.txt'))).toBe(false)
        } finally {
            fs.rmSync(tmpOuterDir, { recursive: true, force: true })
            fs.rmSync(tmpWorkspaceDir, { recursive: true, force: true })
        }
    })

    test('safe execution argument handling with special characters and spaces in filenames', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-special-'))
        const archivePath = path.join(tmpDir, '.december-handoff.tar.gz')
        const extractDir = path.join(tmpDir, 'extracted')

        try {
            const specialDir = path.join(tmpDir, 'dir with spaces & symbols $#')
            fs.mkdirSync(specialDir, { recursive: true })
            fs.writeFileSync(
                path.join(specialDir, 'file with quotes "hello" and spaces.txt'),
                'content with spaces'
            )

            await createWorkspaceArchive(archivePath, tmpDir)
            expect(fs.existsSync(archivePath)).toBe(true)

            fs.mkdirSync(extractDir, { recursive: true })
            const { execSync } = await import('node:child_process')
            execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`)

            expect(
                fs.existsSync(
                    path.join(
                        extractDir,
                        'dir with spaces & symbols $#',
                        'file with quotes "hello" and spaces.txt'
                    )
                )
            ).toBe(true)
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    test('pre-scan detects high-entropy and common API keys in workspace files', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-secrets-'))
        try {
            fs.writeFileSync(
                path.join(tmpDir, 'config.ts'),
                'export const key = "sk-abcdef1234567890abcdef1234567890"'
            )
            fs.writeFileSync(
                path.join(tmpDir, 'aws.ts'),
                'export const aws = "AKIAIOSFODNN7EXAMPLE"'
            )
            fs.writeFileSync(path.join(tmpDir, 'clean.ts'), 'export const clean = 123')

            const result = scanWorkspaceForHandoff(tmpDir)

            expect(result.detectedSecrets.length).toBeGreaterThanOrEqual(2)
            expect(
                result.detectedSecrets.some(
                    (s) => s.includes('OpenAI API Key') && s.includes('config.ts')
                )
            ).toBe(true)
            expect(
                result.detectedSecrets.some(
                    (s) => s.includes('AWS Access Key') && s.includes('aws.ts')
                )
            ).toBe(true)
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    test('enforces file count and size limits in workspace scan', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-limits-'))
        try {
            fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'hello world 1')
            fs.writeFileSync(path.join(tmpDir, 'file2.txt'), 'hello world 2')

            // Exceeds maxFiles = 1
            expect(() => scanWorkspaceForHandoff(tmpDir, { maxFiles: 1 })).toThrow(
                'Workspace exceeds maximum limit'
            )

            // Exceeds maxUncompressedBytes = 5
            expect(() => scanWorkspaceForHandoff(tmpDir, { maxUncompressedBytes: 5 })).toThrow(
                'Workspace exceeds maximum uncompressed size'
            )
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })
})
