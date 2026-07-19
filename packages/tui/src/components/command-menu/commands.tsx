import { execSync, exec } from 'child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import clipboard from 'clipboardy'

import type { Command } from './types'

export const COMMANDS: Command[] = [
    {
        name: 'context',
        description: 'Visualize current context usage',
        value: '/context',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'copy',
        description: 'Copy the last planner response to the clipboard',
        value: '/copy',
        action: (ctx) => {
            if (ctx.agent && ctx.agent.messages.length > 0) {
                try {
                    const plannerMessages = ctx.agent.messages.filter((m) => m.role === 'assistant')
                    const lastMsg =
                        plannerMessages.length > 0
                            ? plannerMessages[plannerMessages.length - 1]
                            : null
                    if (lastMsg && lastMsg.content) {
                        clipboard.writeSync(lastMsg.content)
                        ctx.toast.show({
                            variant: 'success',
                            message: 'Copied last planner response to clipboard!',
                        })
                    } else {
                        ctx.toast.show({
                            variant: 'error',
                            message: 'No planner response found to copy.',
                        })
                    }
                } catch (e) {
                    ctx.toast.show({ variant: 'error', message: 'Failed to write to clipboard.' })
                }
            } else {
                ctx.toast.show({ variant: 'error', message: 'Nothing to copy.' })
            }
        },
    },
    {
        name: 'exit',
        description: 'Exit the CLI',
        value: '/exit',
        action: (ctx) => {
            ctx.exit()
        },
    },
    {
        name: 'fork',
        description: 'Create a branch of the current conversation at this point',
        value: '/fork',
        action: async (ctx) => {
            if (ctx.agent) {
                const newId = await ctx.agent.forkContext()
                ctx.toast.show({ variant: 'success', message: `Forked to new session: ${newId}` })
            }
        },
    },
    {
        name: 'grill-me',
        description: 'Interview me to align on a plan',
        value: '/grill-me',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'handoff',
        description: 'Hand off a task to a remote December session (cloud)',
        value: '/handoff',
        action: async (ctx) => {
            try {
                const configPath = path.join(os.homedir(), '.config', 'december', 'config.json')
                let config: any = {}
                try {
                    if (fs.existsSync(configPath)) {
                        config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
                    }
                } catch (e) {}

                if (!config.decemberToken) {
                    ctx.toast.show({
                        variant: 'error',
                        message: 'You must be logged in to use handoff.',
                    })
                    return
                }

                ctx.toast.show({ variant: 'info', message: 'Zipping workspace...' })

                const archivePath = '.december-handoff.tar.gz'
                const excludes = [
                    '--exclude=node_modules',
                    '--exclude=.git',
                    `--exclude=${archivePath}`,
                ]
                try {
                    if (fs.existsSync('.gitignore')) {
                        const lines = fs.readFileSync('.gitignore', 'utf8').split('\n')
                        for (const line of lines) {
                            const t = line.trim()
                            if (t && !t.startsWith('#'))
                                excludes.push(`--exclude=${t.endsWith('/') ? t.slice(0, -1) : t}`)
                        }
                    }
                    if (fs.existsSync('.decemberignore')) {
                        const lines = fs.readFileSync('.decemberignore', 'utf8').split('\n')
                        for (const line of lines) {
                            const t = line.trim()
                            if (t && !t.startsWith('#'))
                                excludes.push(`--exclude=${t.endsWith('/') ? t.slice(0, -1) : t}`)
                        }
                    }
                } catch (e) {}

                const excludeArgs = excludes.join(' ')
                try {
                    execSync(`tar -czf ${archivePath} ${excludeArgs} .`, { stdio: 'ignore' })
                } catch (e: any) {
                    if (e.status !== 1) throw e
                }

                ctx.toast.show({ variant: 'info', message: 'Requesting upload URL...' })

                const serverUrl = process.env.DECEMBER_SERVER_URL || 'https://api.trydecember.com'
                const proxyUrl = `${serverUrl}/api/v1`
                const urlRes = await fetch(`${proxyUrl}/cli/handoff/upload-url`, {
                    headers: { Authorization: `Bearer ${config.decemberToken}` },
                })
                if (!urlRes.ok) throw new Error(await urlRes.text())
                const { uploadUrl, objectKey } = (await urlRes.json()) as any

                ctx.toast.show({ variant: 'info', message: 'Uploading to MinIO...' })

                const fileData = fs.readFileSync(archivePath)
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: fileData,
                })
                if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`)

                ctx.toast.show({ variant: 'info', message: 'Completing handoff...' })

                const sessionRes = await fetch(`${proxyUrl}/cli/handoff/complete`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${config.decemberToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: 'Handoff from ' + process.cwd().split('/').pop(),
                        messages: ctx.agent ? ctx.agent.messages : [],
                        objectKey,
                    }),
                })
                if (!sessionRes.ok) throw new Error(await sessionRes.text())

                fs.unlinkSync(archivePath)

                ctx.toast.show({ variant: 'success', message: 'Handoff complete! Exiting in 3s.' })

                setTimeout(() => ctx.exit(), 3000)
            } catch (e: any) {
                ctx.toast.show({ variant: 'error', message: `Handoff failed: ${e.message}` })
            }
        },
    },

    {
        name: 'init',
        description: 'Create a .december folder with initial agent rules',
        value: '/init',
        action: (ctx) => {
            try {
                const rootDir = process.cwd()
                const decDir = path.join(rootDir, '.december')

                if (fs.existsSync(decDir)) {
                    ctx.toast.show({ message: 'December workspace is already initialized.' })
                    return
                }

                fs.mkdirSync(decDir)

                const agentsFile = path.join(decDir, 'AGENTS.md')

                const rulesDir = path.join(decDir, 'rules')
                const rulesReadme = path.join(rulesDir, 'README.md')
                const skillsDir = path.join(decDir, 'skills')
                const skillsReadme = path.join(skillsDir, 'README.md')

                fs.writeFileSync(agentsFile, '')

                fs.mkdirSync(rulesDir)
                fs.writeFileSync(
                    rulesReadme,
                    '# Rules\n\nDrop Markdown files here (e.g., `database.md` or `styling.md`) with specific instructions. December will automatically read these modular rules when working on related files.\n'
                )

                fs.mkdirSync(skillsDir)
                fs.writeFileSync(
                    skillsReadme,
                    '# Skills\n\nAdd executable scripts or custom tool definitions here. December will be able to run these skills as custom tools to perform specific actions in your workspace.\n'
                )

                ctx.toast.show({
                    variant: 'success',
                    message: 'Initialized December workspace successfully!',
                })
            } catch (err) {
                ctx.toast.show({
                    variant: 'error',
                    message: 'Failed to initialize December workspace',
                })
            }
        },
    },
    {
        name: 'login',
        description: 'Configure API keys or Connect via December Cloud',
        value: '/login',
        action: (ctx) => {
            ctx.toast.show({ message: 'Opening browser to sign in...' })
        },
    },
    {
        name: 'logout',
        description: 'Clear stored credentials',
        value: '/logout',
        action: (ctx) => {
            ctx.toast.show({ variant: 'success', message: 'Signed out' })
        },
    },

    {
        name: 'model',
        description: 'Select a model',
        value: '/model',
        action: (ctx) => {
            ctx.toast.show({ message: 'Use arrow keys to select a model.' })
        },
    },
    {
        name: 'new',
        description: 'Start a new conversation',
        value: '/new',
        action: async (ctx) => {
            if (ctx.agent) {
                await ctx.agent.newContext()
                ctx.resetChat?.()
                ctx.toast.show({ variant: 'success', message: 'Started a new conversation.' })
            }
        },
    },
    {
        name: 'plan',
        description: 'Switch to plan mode',
        value: '/plan',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'resume',
        description: 'Browse and resume past conversations',
        value: '/resume',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },

    {
        name: 'settings',
        description: 'Open settings',
        value: '/settings',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },

    {
        name: 'tasks',
        description: 'View background tasks',
        value: '/tasks',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
    {
        name: 'update',
        description: 'Update to the latest version',
        value: '/update',
        action: (ctx) => {
            exec('npm install -g @trydecember/cli', (err) => {
                if (err) {
                    // update failed silently in bg, but we can't easily toast here if app is closed.
                }
            })
            ctx.toast.show({ message: 'Updating CLI in the background. Please restart soon.' })
        },
    },
    {
        name: 'usage',
        description: 'View quota usage',
        value: '/usage',
        action: (ctx) => {
            // forwarded to chat screen
        },
    },
]
