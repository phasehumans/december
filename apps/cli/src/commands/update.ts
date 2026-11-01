import pkg from '../../package.json' with { type: 'json' }

export async function handleUpdateCommand(options?: { force?: boolean }): Promise<void> {
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
        onResolvedVersion: (info) => {
            reporter.stopSpinner()
            reporter.item('current version', `v${info.currentVersion}`)
            if (info.targetVersion) {
                reporter.item('latest version', `v${info.targetVersion}`)
            }
            if (info.activeBinaryPath) {
                reporter.item('active binary', info.activeBinaryPath)
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
        reporter.tree('git pull && bun install && bun --cwd apps/cli run build')
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

    if (result.alreadyUpToDate) {
        reporter.tree(
            `you are already using the latest version of December CLI (v${result.installedVersion || result.targetVersion}).`
        )
        reporter.tree('use december update --force to reinstall.')
        reporter.space()
        reporter.step('nothing to update')
        console.log('')
        return
    }

    if (result.success && result.verified) {
        reporter.step('updating December CLI...')
        reporter.space()
        if (result.targetVersion) {
            reporter.item('updated to', `v${result.installedVersion || result.targetVersion}`)
        }
        reporter.item('method', result.method)
        reporter.space()
        reporter.success(`package successfully updated via ${result.method}`)

        if (result.collisionFixed && result.cleanedBinaries && result.cleanedBinaries.length > 0) {
            reporter.success(
                `aligned ${result.cleanedBinaries.length} older conflicting binary location(s)`
            )
            for (const b of result.cleanedBinaries) {
                reporter.tree(`• cleaned: ${b}`)
            }
        }

        if (result.shellHashNotice) {
            reporter.space()
            reporter.warn('shell cached previous binary path.')
            reporter.tree('run "hash -r" (bash) or "rehash" (zsh) or restart terminal.')
        }

        reporter.space()
        reporter.step('update complete')
        reporter.space()
        reporter.tree('run december to start your session')
        reporter.space()
        reporter.step('ready')
        console.log('')
    } else {
        reporter.step('update attention needed')
        reporter.space()

        if (!result.verified && result.shadowingBinary) {
            reporter.warn('update completed, but active terminal still starts an older version!')
            reporter.space()
            reporter.item(
                'installed version',
                `v${result.installedVersion || result.targetVersion} (${result.method})`
            )
            reporter.item(
                'active in $path',
                `v${result.activeVersion || 'older'} (${result.activeBinaryPath || result.shadowingBinary.path})`
            )
            reporter.space()
            reporter.tree(
                'reason: your shell resolves the older path before the newly updated location.'
            )

            if (result.failedBinaries && result.failedBinaries.some((b) => b.needsSudo)) {
                reporter.space()
                reporter.warn('elevated permissions required to clean older binary:')
                for (const fb of result.failedBinaries) {
                    if (fb.needsSudo) {
                        reporter.tree(`sudo rm "${fb.path}"`)
                    }
                }
            } else {
                reporter.space()
                reporter.tree('to ensure your terminal uses the latest version:')
                reporter.tree(`1. remove older binary: rm "${result.shadowingBinary.path}"`)
                reporter.tree(`2. or rehash shell cache: hash -r (bash) or rehash (zsh)`)
            }
            reporter.space()
            reporter.step('action required')
        } else if (result.isPermissionError) {
            reporter.error('permission denied while installing global package')
            reporter.space()
            reporter.tree('try running with elevated permissions:')
            reporter.tree(result.sudoCmd || result.manualCmd)
            reporter.space()
            reporter.step('update failed')
        } else {
            reporter.error(`update failed via ${result.method}: ${result.error || 'Unknown error'}`)
            reporter.space()
            reporter.tree('try running manually:')
            reporter.tree(result.manualCmd)
            reporter.space()
            reporter.step('update failed')
        }
        console.log('')
        process.exitCode = 1
    }
}
