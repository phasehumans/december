import { CHANGELOG_URL } from '@december/shared'

import pkg from '../../package.json' with { type: 'json' }

export async function handleUpdateCommand(options?: {
    force?: boolean
    check?: boolean
}): Promise<void> {
    const { performCliUpdate } = await import('../utils/updater')
    const { TreeReporter } = await import('../utils/tree-reporter')
    const reporter = new TreeReporter()

    console.log('')
    reporter.step('checking December CLI for updates...')
    reporter.space()
    reporter.startSpinner('fetching latest release information...')

    const result = await performCliUpdate({
        currentVersion: pkg.version,
        force: options?.force,
        checkOnly: options?.check,
        onResolvedVersion: (info) => {
            reporter.stopSpinner()
            reporter.item('current version', `v${info.currentVersion}`)
            if (info.targetVersion) {
                reporter.item('latest version', `v${info.targetVersion}`)
            }
            if (info.installPath) {
                reporter.item('install path', info.installPath)
            }
            reporter.space()
        },
        onProgress: (msg) => {
            reporter.startSpinner(msg)
        },
    })

    reporter.stopSpinner()

    if (result.method === 'source') {
        reporter.step('December CLI development build')
        reporter.space()
        reporter.tree('detected local source development repository.')
        reporter.tree('to rebuild or update your local dev build, run:')
        reporter.tree(result.manualCmd)
        reporter.space()
        reporter.step('ready')
        console.log('')
        return
    }

    if (result.method === 'npx') {
        reporter.step('December CLI ephemeral build')
        reporter.space()
        reporter.tree('running via npx/bunx ephemeral execution.')
        reporter.tree('each invocation automatically pulls the latest version.')
        reporter.space()
        reporter.step('ready')
        console.log('')
        return
    }

    if (result.offline) {
        reporter.error(result.error || 'could not reach the npm registry')
        reporter.space()
        reporter.step('update failed')
        console.log('')
        process.exitCode = 1
        return
    }

    if (options?.check && !result.alreadyUpToDate && result.success) {
        reporter.tree(`v${result.targetVersion} is available.`)
        reporter.tree('to install it, run: december update')
        reporter.tree(`what's new: ${CHANGELOG_URL}`)
        reporter.space()
        reporter.step('update available')
        console.log('')
        return
    }

    if (result.alreadyUpToDate) {
        reporter.tree(
            `you are already using the latest version of December CLI (v${result.installedVersion || result.targetVersion}).`
        )
        if (!options?.check) {
            reporter.tree('use december update --force to reinstall.')
        }
        reporter.space()
        reporter.step('nothing to update')
        console.log('')
        return
    }

    if (result.success && result.verified) {
        reporter.success(`updated to v${result.installedVersion || result.targetVersion}`)
        reporter.item('method', result.method)
        reporter.space()
        reporter.tree(`what's new: ${CHANGELOG_URL}`)
        reporter.tree('run december to start your session')
        reporter.space()
        reporter.step('update complete')
        console.log('')
        return
    }

    reporter.step('update attention needed')
    reporter.space()

    if (result.shadowingBinary) {
        reporter.warn(result.error || 'your shell still starts an older version.')
        reporter.space()
        reporter.item('updated install', result.installPath || `v${result.installedVersion}`)
        reporter.item(
            'shell runs',
            `v${result.activeVersion || 'older'} (${result.shadowingBinary.path})`
        )
        reporter.space()
        if (result.legacyBinaryPath) {
            reporter.tree('this is the retired standalone binary. remove it with:')
            reporter.tree(
                process.platform === 'win32'
                    ? `del "${result.legacyBinaryPath}"`
                    : `rm "${result.legacyBinaryPath}"`
            )
        } else {
            reporter.tree(
                'remove the older install with the package manager that created it, or put this install first in your PATH.'
            )
            reporter.tree('run december doctor to see every install on this machine.')
        }
        if (process.platform !== 'win32') {
            reporter.tree('then run "hash -r" (bash) or "rehash" (zsh), or open a new terminal.')
        }
        reporter.space()
        reporter.step('action required')
    } else if (result.isPermissionError) {
        reporter.error('permission denied while installing the global package')
        reporter.space()
        if (result.permissionHint) {
            reporter.tree(result.permissionHint)
        } else {
            reporter.tree('try running with elevated permissions:')
            reporter.tree(result.sudoCmd || result.manualCmd)
        }
        reporter.space()
        reporter.step('update failed')
    } else {
        reporter.error(`update failed via ${result.method}: ${result.error || 'unknown error'}`)
        reporter.space()
        reporter.tree('try running manually:')
        reporter.tree(result.manualCmd)
        reporter.space()
        reporter.step('update failed')
    }
    console.log('')
    process.exitCode = 1
}

export interface UpdateNotice {
    toast: string
    variant: 'success' | 'error' | 'info'
    /** Longer message for the conversation view, when a toast is not enough */
    message?: { role: 'assistant' | 'error'; content: string; hint?: string }
}

/**
 * Describe an update result for the TUI. Kept free of dynamic imports: after an
 * install, npm has replaced the running package's files on disk, so lazy chunks
 * of the old version can no longer be loaded.
 */
export function formatUpdateNotice(result: import('../utils/updater').UpdateResult): UpdateNotice {
    if (result.method === 'source') {
        return {
            toast: 'Running from source. Update with git pull and rebuild.',
            variant: 'info',
            message: {
                role: 'assistant',
                content: `You are running December from a local source checkout. To update it, run:\n\n\`${result.manualCmd}\``,
            },
        }
    }

    if (result.method === 'npx') {
        return {
            toast: 'Running via npx/bunx. Each launch already uses the latest version.',
            variant: 'info',
        }
    }

    if (result.alreadyUpToDate) {
        return {
            toast: `You are on the latest version (v${result.installedVersion || result.currentVersion}).`,
            variant: 'success',
        }
    }

    if (result.success && result.verified) {
        const version = result.installedVersion || result.targetVersion
        return {
            toast: `Updated to v${version}. Press Enter to restart.`,
            variant: 'success',
            message: {
                role: 'assistant',
                content: [
                    `Updated December from v${result.currentVersion} to **v${version}**.`,
                    '',
                    `This session still runs v${result.currentVersion}. Press **Enter** on an empty prompt to restart into v${version} and continue this conversation, or run \`/restart\` later.`,
                    '',
                    `What's new: ${CHANGELOG_URL}`,
                ].join('\n'),
            },
        }
    }

    if (result.offline) {
        return {
            toast: 'Could not reach the npm registry.',
            variant: 'error',
            message: {
                role: 'error',
                content: result.error || 'Could not reach the npm registry.',
            },
        }
    }

    if (result.shadowingBinary) {
        const fix = result.legacyBinaryPath
            ? `Remove the retired standalone binary: \`${process.platform === 'win32' ? 'del' : 'rm'} "${result.legacyBinaryPath}"\``
            : 'Remove the older install with the package manager that created it, or put the updated install first in your PATH. Run `december doctor` to list every install.'
        return {
            toast: `Updated to v${result.installedVersion}, but your shell runs an older december.`,
            variant: 'error',
            message: {
                role: 'error',
                content: result.error || 'Your shell still starts an older version of December.',
                hint: fix,
            },
        }
    }

    if (result.isPermissionError) {
        return {
            toast: 'Update failed: permission denied.',
            variant: 'error',
            message: {
                role: 'error',
                content: 'Permission denied while installing the global package.',
                hint:
                    result.permissionHint ||
                    `Run this in your terminal: \`${result.sudoCmd || result.manualCmd}\``,
            },
        }
    }

    return {
        toast: `Update failed via ${result.method}.`,
        variant: 'error',
        message: {
            role: 'error',
            content: `Update failed via ${result.method}: ${result.error || 'unknown error'}`,
            hint: `Run this in your terminal: \`${result.manualCmd}\``,
        },
    }
}
