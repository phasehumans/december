import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { ArtifactEntry, ArtifactStatus, ArtifactType } from './artifact-types'

export interface SaveArtifactOptions {
    filename: string
    title: string
    type?: ArtifactType
    status?: ArtifactStatus
    summary?: string
    content: string
    requestFeedback?: boolean
}

function isPathLike(str?: string): boolean {
    if (!str) return false
    return (
        str.includes(path.sep) || str.startsWith('/') || str.startsWith('.') || str.startsWith('~')
    )
}

export class ArtifactManager {
    public static getHomeDir(): string {
        return process.env.HOME || process.env.USERPROFILE || os.homedir()
    }

    public static getArtifactsDir(arg1: string, arg2?: string): string {
        let sessionId = arg1
        let customBaseDir: string | undefined

        if (arg2 !== undefined) {
            if (isPathLike(arg1)) {
                customBaseDir = arg1
                sessionId = arg2
            } else {
                sessionId = arg1
                customBaseDir = arg2
            }
        }

        const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
        const base = customBaseDir || path.join(this.getHomeDir(), '.december', 'artifacts')
        return path.join(base, cleanSessionId)
    }

    public static parseFrontmatter(fileContent: string): {
        metadata: Record<string, string>
        body: string
    } {
        const trimmed = fileContent.trimStart()
        if (!trimmed.startsWith('---')) {
            return { metadata: {}, body: fileContent }
        }

        const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
        if (!match) {
            return { metadata: {}, body: fileContent }
        }

        const rawMeta = match[1] || ''
        const body = (match[2] || '').trim()
        const metadata: Record<string, string> = {}

        for (const line of rawMeta.split(/\r?\n/)) {
            const colonIdx = line.indexOf(':')
            if (colonIdx > 0) {
                const key = line.slice(0, colonIdx).trim()
                const value = line.slice(colonIdx + 1).trim()
                metadata[key] = value
            }
        }

        return { metadata, body }
    }

    public static serializeFrontmatter(
        metadata: Record<string, string | number | boolean | undefined>,
        body: string
    ): string {
        const lines: string[] = ['---']
        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined) {
                lines.push(`${key}: ${value}`)
            }
        }
        lines.push('---')
        lines.push('')
        lines.push(body.trim())
        lines.push('')
        return lines.join('\n')
    }

    public static async saveArtifact(
        arg1: string,
        arg2: string | SaveArtifactOptions,
        arg3?: SaveArtifactOptions | string
    ): Promise<ArtifactEntry> {
        let customBaseDir: string | undefined
        let sessionId: string
        let options: SaveArtifactOptions

        if (isPathLike(arg1) && typeof arg2 === 'string' && typeof arg3 === 'object') {
            customBaseDir = arg1
            sessionId = arg2
            options = arg3
        } else if (typeof arg2 === 'object') {
            sessionId = arg1
            options = arg2 as SaveArtifactOptions
            customBaseDir = typeof arg3 === 'string' ? arg3 : undefined
        } else {
            sessionId = arg1
            options = arg3 as SaveArtifactOptions
            customBaseDir = typeof arg2 === 'string' ? arg2 : undefined
        }

        const artifactsDir = this.getArtifactsDir(sessionId, customBaseDir)
        await fs.mkdir(artifactsDir, { recursive: true })

        const safeFilename = path.basename(options.filename).endsWith('.md')
            ? path.basename(options.filename)
            : `${path.basename(options.filename)}.md`

        const filePath = path.join(artifactsDir, safeFilename)
        const now = Date.now()

        let existingCreatedAt = now
        try {
            const existingContent = await fs.readFile(filePath, 'utf8')
            const parsed = this.parseFrontmatter(existingContent)
            if (parsed.metadata.createdAt) {
                const parsedTime = Number.parseInt(parsed.metadata.createdAt, 10)
                if (!Number.isNaN(parsedTime)) {
                    existingCreatedAt = parsedTime
                }
            }
        } catch {
            // Intentionally swallowed: file does not exist yet
        }

        const artifactType: ArtifactType = options.type || 'plan'
        const artifactStatus: ArtifactStatus =
            options.status || (options.requestFeedback ? 'needs_review' : 'draft')
        const artifactId = `${sessionId}-${safeFilename.replace(/\.md$/, '')}`

        const serialized = this.serializeFrontmatter(
            {
                id: artifactId,
                sessionId,
                filename: safeFilename,
                title: options.title,
                type: artifactType,
                status: artifactStatus,
                summary: options.summary || '',
                createdAt: existingCreatedAt,
                updatedAt: now,
                requestFeedback: options.requestFeedback ?? true,
            },
            options.content
        )

        await fs.writeFile(filePath, serialized, 'utf8')

        return {
            id: artifactId,
            sessionId,
            filename: safeFilename,
            filePath,
            title: options.title,
            type: artifactType,
            status: artifactStatus,
            summary: options.summary,
            content: options.content,
            createdAt: existingCreatedAt,
            updatedAt: now,
            requestFeedback: options.requestFeedback ?? true,
        }
    }

    public static async getArtifact(
        arg1: string,
        arg2: string,
        arg3?: string
    ): Promise<ArtifactEntry | null> {
        let customBaseDir: string | undefined
        let sessionId: string
        let filename: string

        if (arg3 !== undefined) {
            if (isPathLike(arg1)) {
                customBaseDir = arg1
                sessionId = arg2
                filename = arg3
            } else {
                sessionId = arg1
                filename = arg2
                customBaseDir = arg3
            }
        } else {
            sessionId = arg1
            filename = arg2
        }

        const artifactsDir = this.getArtifactsDir(sessionId, customBaseDir)
        const safeFilename = path.basename(filename).endsWith('.md')
            ? path.basename(filename)
            : `${path.basename(filename)}.md`

        const filePath = path.join(artifactsDir, safeFilename)

        try {
            const raw = await fs.readFile(filePath, 'utf8')
            const { metadata, body } = this.parseFrontmatter(raw)

            const now = Date.now()
            const createdAt = metadata.createdAt
                ? Number.parseInt(metadata.createdAt, 10) || now
                : now
            const updatedAt = metadata.updatedAt
                ? Number.parseInt(metadata.updatedAt, 10) || now
                : now

            return {
                id: metadata.id || `${sessionId}-${safeFilename.replace(/\.md$/, '')}`,
                sessionId: metadata.sessionId || sessionId,
                filename: safeFilename,
                filePath,
                title: metadata.title || safeFilename,
                type: (metadata.type as ArtifactType) || 'plan',
                status: (metadata.status as ArtifactStatus) || 'draft',
                summary: metadata.summary || undefined,
                content: body,
                createdAt,
                updatedAt,
                requestFeedback: metadata.requestFeedback === 'true',
            }
        } catch {
            // Intentionally swallowed: artifact file does not exist or cannot be read
            return null
        }
    }

    public static async listArtifacts(arg1: string, arg2?: string): Promise<ArtifactEntry[]> {
        let customBaseDir: string | undefined
        let sessionId: string

        if (arg2 !== undefined) {
            if (isPathLike(arg1)) {
                customBaseDir = arg1
                sessionId = arg2
            } else {
                sessionId = arg1
                customBaseDir = arg2
            }
        } else {
            sessionId = arg1
        }

        const artifactsDir = this.getArtifactsDir(sessionId, customBaseDir)
        try {
            const entries = await fs.readdir(artifactsDir)
            const mdFiles = entries.filter((e) => e.endsWith('.md'))

            const results: ArtifactEntry[] = []
            for (const file of mdFiles) {
                const item = await this.getArtifact(sessionId, file, customBaseDir)
                if (item) {
                    results.push(item)
                }
            }

            return results.sort((a, b) => b.updatedAt - a.updatedAt)
        } catch {
            // Intentionally swallowed: directory does not exist yet
            return []
        }
    }

    public static async updateArtifactStatus(
        arg1: string,
        arg2: string,
        arg3: ArtifactStatus | string,
        arg4?: ArtifactStatus
    ): Promise<ArtifactEntry | null> {
        let customBaseDir: string | undefined
        let sessionId: string
        let filename: string
        let status: ArtifactStatus

        if (arg4 !== undefined) {
            if (isPathLike(arg1)) {
                customBaseDir = arg1
                sessionId = arg2
                filename = arg3 as string
                status = arg4
            } else {
                sessionId = arg1
                filename = arg2
                status = arg3 as ArtifactStatus
                customBaseDir = arg4 as unknown as string
            }
        } else {
            sessionId = arg1
            filename = arg2
            status = arg3 as ArtifactStatus
        }

        const existing = await this.getArtifact(sessionId, filename, customBaseDir)
        if (!existing) return null

        return this.saveArtifact(
            sessionId,
            {
                filename: existing.filename,
                title: existing.title,
                type: existing.type,
                status,
                summary: existing.summary,
                content: existing.content,
                requestFeedback: existing.requestFeedback,
            },
            customBaseDir
        )
    }
}
