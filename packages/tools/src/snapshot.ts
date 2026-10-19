import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface SnapshotRecord {
    id: string
    commitHash: string
    turnIndex: number
    messageId?: string
    prompt?: string
    timestamp: number
    touchedFiles: string[]
}

export interface RollbackResult {
    success: boolean
    targetTurn: number
    commitHash: string
    restoredFiles: string[]
    deletedFiles: string[]
}

export class SnapshotManager {
    public readonly workspaceDir: string
    public readonly snapshotsDir: string
    private readonly recordsFile: string
    private records: SnapshotRecord[] = []
    private initialized = false
    private tracking = true

    constructor(workspaceDir?: string, customSnapshotsDir?: string) {
        this.workspaceDir = path.resolve(workspaceDir || process.cwd())
        this.snapshotsDir = customSnapshotsDir
            ? path.resolve(customSnapshotsDir)
            : path.join(this.workspaceDir, '.december', 'snapshots')
        this.recordsFile = path.join(this.snapshotsDir, 'records.json')
    }

    public isTracking(): boolean {
        return this.tracking
    }

    public setTracking(enabled: boolean): void {
        this.tracking = enabled
    }

    public async init(): Promise<void> {
        if (this.initialized) return

        await fs.mkdir(this.snapshotsDir, { recursive: true })

        // Check if git is already initialized in snapshotsDir
        const headPath = path.join(this.snapshotsDir, 'HEAD')
        let exists = false
        try {
            await fs.access(headPath)
            exists = true
        } catch {
            // Intentionally swallowed: repository not initialized yet
        }

        if (!exists) {
            await execFileAsync('git', ['init', '--bare', this.snapshotsDir], {
                cwd: this.workspaceDir,
            })
        }

        // Configure alternates if workspace is a git repository
        const workspaceGitObjects = path.join(this.workspaceDir, '.git', 'objects')
        let hasWorkspaceObjects = false
        try {
            const stat = await fs.stat(workspaceGitObjects)
            hasWorkspaceObjects = stat.isDirectory()
        } catch {
            // Intentionally swallowed: workspace has no .git/objects
        }

        if (hasWorkspaceObjects) {
            const alternatesDir = path.join(this.snapshotsDir, 'objects', 'info')
            await fs.mkdir(alternatesDir, { recursive: true })
            const alternatesFile = path.join(alternatesDir, 'alternates')
            await fs.writeFile(alternatesFile, `${workspaceGitObjects}\n`, 'utf8')
        }

        // Configure shadow git exclude list to protect internal state
        const infoDir = path.join(this.snapshotsDir, 'info')
        await fs.mkdir(infoDir, { recursive: true })
        const excludeFile = path.join(infoDir, 'exclude')

        const defaultExcludes = [
            '.december',
            '.git',
            'node_modules',
            'dist',
            '.turbo',
            '.next',
            '.cache',
        ]

        // Inherit workspace .gitignore rules if present
        const workspaceGitignore = path.join(this.workspaceDir, '.gitignore')
        try {
            const gitignoreContent = await fs.readFile(workspaceGitignore, 'utf8')
            for (const line of gitignoreContent.split('\n')) {
                const trimmed = line.trim()
                if (trimmed && !trimmed.startsWith('#') && !defaultExcludes.includes(trimmed)) {
                    defaultExcludes.push(trimmed)
                }
            }
        } catch {
            // Intentionally swallowed: workspace does not have a .gitignore file
        }

        await fs.writeFile(excludeFile, `${defaultExcludes.join('\n')}\n`, 'utf8')

        // Load existing records if available
        try {
            const content = await fs.readFile(this.recordsFile, 'utf8')
            this.records = JSON.parse(content)
        } catch {
            // Intentionally swallowed: no previous records found
            this.records = []
        }

        this.initialized = true
    }

    public async createSnapshot(options: {
        turnIndex: number
        messageId?: string
        prompt?: string
    }): Promise<SnapshotRecord> {
        await this.init()

        const { turnIndex, messageId, prompt } = options

        // 1. Stage all workspace files into shadow git
        await execFileAsync(
            'git',
            ['--git-dir', this.snapshotsDir, '--work-tree', this.workspaceDir, 'add', '-A'],
            { cwd: this.workspaceDir }
        )

        // 2. Write tree
        const { stdout: treeOut } = await execFileAsync(
            'git',
            ['--git-dir', this.snapshotsDir, '--work-tree', this.workspaceDir, 'write-tree'],
            { cwd: this.workspaceDir }
        )
        const treeHash = treeOut.trim()

        // 3. Commit tree
        const prevRecord = this.records[this.records.length - 1]
        const commitArgs = ['--git-dir', this.snapshotsDir, 'commit-tree']
        if (prevRecord?.commitHash) {
            commitArgs.push('-p', prevRecord.commitHash)
        }
        const commitMessage = `Turn ${turnIndex}: ${prompt || 'turn snapshot'}`
        commitArgs.push('-m', commitMessage, treeHash)

        const { stdout: commitOut } = await execFileAsync('git', commitArgs, {
            cwd: this.workspaceDir,
        })
        const commitHash = commitOut.trim()

        // 4. Determine touched files compared to previous commit
        let touchedFiles: string[] = []
        if (prevRecord?.commitHash) {
            try {
                const { stdout: diffOut } = await execFileAsync(
                    'git',
                    [
                        '--git-dir',
                        this.snapshotsDir,
                        'diff',
                        '--name-only',
                        prevRecord.commitHash,
                        commitHash,
                    ],
                    { cwd: this.workspaceDir }
                )
                touchedFiles = diffOut
                    .split('\n')
                    .map((f) => f.trim())
                    .filter(Boolean)
            } catch {
                // Intentionally swallowed: fallback when diff fails
            }
        }

        const record: SnapshotRecord = {
            id: `snap-${Date.now()}-${turnIndex}`,
            commitHash,
            turnIndex,
            messageId,
            prompt,
            timestamp: Date.now(),
            touchedFiles,
        }

        this.records.push(record)
        await this.persistRecords()

        return record
    }

    public getSnapshots(): SnapshotRecord[] {
        return [...this.records]
    }

    public getSnapshotForTurn(turnIndex: number): SnapshotRecord | undefined {
        return this.records.find((r) => r.turnIndex === turnIndex)
    }

    public async rollbackToTurn(targetTurn: number): Promise<RollbackResult> {
        await this.init()

        const targetRecord = this.getSnapshotForTurn(targetTurn)
        if (!targetRecord) {
            throw new Error(`Snapshot for turn ${targetTurn} not found.`)
        }

        const commitHash = targetRecord.commitHash

        // Stage current workspace state into shadow git so diff is accurate
        await execFileAsync(
            'git',
            ['--git-dir', this.snapshotsDir, '--work-tree', this.workspaceDir, 'add', '-A'],
            { cwd: this.workspaceDir }
        )

        // Diff current shadow git working tree vs target commit
        const { stdout: diffOut } = await execFileAsync(
            'git',
            [
                '--git-dir',
                this.snapshotsDir,
                '--work-tree',
                this.workspaceDir,
                'diff',
                '--name-status',
                commitHash,
            ],
            { cwd: this.workspaceDir }
        )

        const restoredFiles: string[] = []
        const deletedFiles: string[] = []

        const lines = diffOut.split('\n').filter((l) => l.trim().length > 0)
        for (const line of lines) {
            const parts = line.split('\t')
            const status = parts[0]?.trim()
            const filePath = parts[1]?.trim()
            if (!status || !filePath) continue

            const absPath = path.resolve(this.workspaceDir, filePath)

            if (status === 'A') {
                // File was added after target snapshot; delete it
                try {
                    await fs.rm(absPath, { recursive: true, force: true })
                    deletedFiles.push(filePath)
                } catch {
                    // Intentionally swallowed: file already deleted or inaccessible
                }
            } else {
                // File was modified or deleted; restore it from target snapshot commit
                try {
                    await execFileAsync(
                        'git',
                        [
                            '--git-dir',
                            this.snapshotsDir,
                            '--work-tree',
                            this.workspaceDir,
                            'checkout',
                            commitHash,
                            '--',
                            filePath,
                        ],
                        { cwd: this.workspaceDir }
                    )
                    restoredFiles.push(filePath)
                } catch {
                    // Intentionally swallowed: checkout failure handled
                }
            }
        }

        // Truncate snapshot records to targetTurn
        const targetIndex = this.records.findIndex((r) => r.turnIndex === targetTurn)
        if (targetIndex !== -1) {
            this.records = this.records.slice(0, targetIndex + 1)
            await this.persistRecords()
        }

        return {
            success: true,
            targetTurn,
            commitHash,
            restoredFiles,
            deletedFiles,
        }
    }

    public async rollbackLastTurn(): Promise<RollbackResult> {
        await this.init()

        if (this.records.length === 0) {
            throw new Error('No snapshots available to rollback.')
        }

        // Roll back to the latest recorded turn snapshot (pre-flight state of the latest turn)
        const target = this.records[this.records.length - 1]!
        return this.rollbackToTurn(target.turnIndex)
    }

    public async onBeforeFileMutation(filePath: string): Promise<void> {
        if (!this.tracking) return
        await this.init()

        // Stage file if it exists
        try {
            const abs = path.resolve(this.workspaceDir, filePath)
            await fs.access(abs)
            await execFileAsync(
                'git',
                ['--git-dir', this.snapshotsDir, '--work-tree', this.workspaceDir, 'add', abs],
                { cwd: this.workspaceDir }
            )
        } catch {
            // Intentionally swallowed: file does not exist yet (newly created)
        }
    }

    private async persistRecords(): Promise<void> {
        try {
            await fs.writeFile(this.recordsFile, JSON.stringify(this.records, null, 2), 'utf8')
        } catch {
            // Intentionally swallowed: persistence failure
        }
    }
}

let activeSnapshotManager: SnapshotManager | null = null

export function getSnapshotManager(workspaceDir?: string): SnapshotManager {
    const resolved = path.resolve(workspaceDir || process.cwd())
    if (!activeSnapshotManager || activeSnapshotManager.workspaceDir !== resolved) {
        activeSnapshotManager = new SnapshotManager(resolved)
    }
    return activeSnapshotManager
}

export function setSnapshotManager(manager: SnapshotManager | null): void {
    activeSnapshotManager = manager
}
