import '../../env'

import { prisma } from '@december/database'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'

const verifyGitHubRepoAccessMock = mock(async () => ({
    ok: true,
    owner: 'owner',
    repo: 'repo',
    normalizedUrl: 'https://github.com/owner/repo',
    cloneUrl: 'https://github.com/owner/repo.git',
    defaultBranch: 'main',
    archived: false,
    disabled: false,
    visibility: 'public',
    canAccess: true,
}))

const downloadGitHubRepoArchiveMock = mock(async () => ({
    ok: true,
    owner: 'owner',
    repo: 'repo',
    ref: 'main',
    zipUrl: '',
    tempRootDir: '/tmp',
    zipFilePath: '',
    extractDir: '/tmp',
    repoRootDir: '/tmp',
}))

const validateImportProjectMock = mock(async () => ({
    rootDir: '/tmp',
    files: [],
    totalBytes: 0,
    detection: { framework: 'vite', packageJson: {} },
    isValid: true,
}))

mock.module('../../../src/modules/import/import.utils', () => ({
    importStagingRootDir: () => '/tmp',
    cleanupImportDir: async () => {},
    persistentImportSourceDir: () => '/tmp',
    persistImportSourceLocally: async () => '/tmp',
    validateImportProject: validateImportProjectMock,
    parseGitHubRepoUrl: () => ({
        ok: true,
        owner: 'owner',
        repo: 'repo',
        normalizedUrl: 'https://github.com/owner/repo',
    }),
    verifyGitHubRepoAccess: verifyGitHubRepoAccessMock,
    downloadGitHubRepoArchive: downloadGitHubRepoArchiveMock,
}))

mock.module('../../../src/modules/runtime/runtime.service', () => ({
    runtimeService: {
        startPreview: async () => ({ backendStatus: 'ready', previewUrl: 'http://localhost:8080' }),
        getPreviewStatus: async () => ({
            backendStatus: 'ready',
            previewUrl: 'http://localhost:8080',
        }),
    },
}))

import { uploadService } from '../../../src/modules/import/import.service'

describe('import.service.integration', () => {
    let user: any

    beforeEach(async () => {
        verifyGitHubRepoAccessMock.mockClear()
        downloadGitHubRepoArchiveMock.mockClear()
        validateImportProjectMock.mockClear()

        await prisma.projectVersion.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        user = await prisma.user.create({
            data: {
                name: 'Test User',
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                emailVerified: true,
                githubToken: 'gh-token-123',
            },
        })
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('importFromGithub', () => {
        it('should create placeholder project and return queued import record', async () => {
            const result = await uploadService.importFromGithub({
                userId: user.id,
                repoURL: 'https://github.com/owner/repo',
            })

            expect(result.id).toBeDefined()
            expect(result.sourceType).toBe('GITHUB')
            expect(result.status).toBe('PENDING')
            expect(result.projectId).toBeDefined()

            // Verify project and import records are in DB
            const dbProject = await prisma.project.findUnique({
                where: { id: result.projectId! },
            })
            expect(dbProject).not.toBeNull()
            expect(dbProject!.name).toBe('repo')
        })
    })

    describe('getImportStatus', () => {
        it('should get correct status of existing import record', async () => {
            const importRecord = await prisma.projectImport.create({
                data: {
                    userId: user.id,
                    sourceType: 'GITHUB',
                    sourceUrl: 'https://github.com/owner/repo',
                    status: 'PENDING',
                },
            })

            const status = await uploadService.getImportStatus({
                userId: user.id,
                importId: importRecord.id,
            })

            expect(status.id).toBe(importRecord.id)
            expect(status.status).toBe('PENDING')
        })
    })
})
