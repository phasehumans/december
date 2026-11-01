import pkg from '../../package.json' with { type: 'json' }

export async function handleDoctorCommand(options?: { fix?: boolean }): Promise<void> {
    const { diagnoseBinaryCollisions, resolveAndCleanStaleBinaries } =
        await import('../utils/bin-discovery')
    const { getAuthStatus, loadConfig } = await import('../config')

    const BLUE = '\x1b[38;2;135;178;244m'
    const GREEN = '\x1b[38;2;110;231;183m'
    const YELLOW = '\x1b[38;2;253;224;71m'
    const RED = '\x1b[38;2;252;165;165m'
    const WHITE = '\x1b[38;2;244;244;245m'
    const GRAY = '\x1b[38;2;161;161;170m'
    const RESET = '\x1b[0m'

    console.log(`\n${BLUE}✱${RESET}  ${WHITE}December CLI Health & Environment Doctor${RESET}\n`)

    // 1. Environment & Runtime
    const runtimeName =
        typeof (process as any).isBun !== 'undefined' || process.versions.bun ? 'Bun' : 'Node.js'
    const runtimeVer = (process.versions as any).bun || process.versions.node
    console.log(`${WHITE}Environment & Runtime:${RESET}`)
    console.log(`  • CLI Package Version: ${GREEN}v${pkg.version}${RESET}`)
    console.log(
        `  • Runtime:             ${GRAY}${runtimeName} v${runtimeVer} (${process.platform}-${process.arch})${RESET}`
    )
    console.log(`  • Process Executable:  ${GRAY}${process.execPath}${RESET}`)
    console.log(`  • Executing Script:    ${GRAY}${process.argv[1] || 'unknown'}${RESET}`)
    console.log('')

    // 2. Binary Installations & PATH Collisions
    console.log(`${WHITE}Installed Binaries & $PATH Precedence:${RESET}`)
    const diagnosis = await diagnoseBinaryCollisions({ argv1: process.argv[1] })

    if (diagnosis.allBinaries.length === 0) {
        console.log(`  ${YELLOW}⚠ No standalone binaries found in standard PATH entries.${RESET}`)
    } else {
        for (const bin of diagnosis.allBinaries) {
            const statusTag = bin.isActive
                ? `${GREEN}[ACTIVE]${RESET}`
                : `${YELLOW}[SHADOWED]${RESET}`
            const verStr = bin.version ? `v${bin.version}` : 'unknown'
            console.log(
                `  • ${statusTag} ${WHITE}${verStr}${RESET} (${bin.manager}) -> ${GRAY}${bin.path}${RESET}`
            )
            if (bin.isSymlink) {
                console.log(`    ${GRAY}↳ points to: ${bin.realPath}${RESET}`)
            }
        }
    }
    console.log('')

    // 3. Collision Resolution / Fix
    if (diagnosis.hasCollision) {
        if (options?.fix) {
            console.log(`${BLUE}✱${RESET}  ${WHITE}Resolving binary collisions (--fix)...${RESET}`)
            const target = diagnosis.activeBinary || diagnosis.allBinaries[0]
            if (target) {
                const { cleanedOrForwarded, failedBinaries } = await resolveAndCleanStaleBinaries(
                    target,
                    diagnosis.allBinaries
                )
                if (cleanedOrForwarded.length > 0) {
                    console.log(
                        `  ${GREEN}Forwarded ${cleanedOrForwarded.length} shadowed binary path(s) to primary active binary (${target.path}).${RESET}`
                    )
                    console.log(
                        `  ${YELLOW}ℹ Run "hash -r" (bash) or restart your terminal to apply.${RESET}\n`
                    )
                } else if (failedBinaries.length === 0) {
                    console.log(`  ${GREEN}All binary links are already aligned.${RESET}\n`)
                }

                if (failedBinaries.length > 0) {
                    console.log(
                        `  ${RED}Failed to forward ${failedBinaries.length} binary path(s) due to permissions:${RESET}`
                    )
                    for (const fb of failedBinaries) {
                        if (fb.needsSudo) {
                            console.log(
                                `    ${YELLOW}• ${fb.path} -> Run: sudo rm "${fb.path}" (or sudo ln -sf "${target.path}" "${fb.path}")${RESET}`
                            )
                        } else {
                            console.log(`    ${YELLOW}• ${fb.path}: ${fb.error}${RESET}`)
                        }
                    }
                    console.log('')
                }
            }
        } else {
            console.log(
                `  ${YELLOW}⚠ Multiple installations detected!${RESET} ${GRAY}Run ${WHITE}december doctor --fix${GRAY} to auto-align stale paths.${RESET}\n`
            )
        }
    } else {
        console.log(`  ${GREEN}No binary collisions detected. Clean single installation.${RESET}\n`)
    }

    // 4. Configuration & Auth
    const config = await loadConfig()
    const authStatus = await getAuthStatus()
    console.log(`${WHITE}Configuration & Authentication:${RESET}`)

    const subCount = config.subscriptions ? Object.keys(config.subscriptions).length : 0
    if (subCount > 0) {
        const subList = Object.keys(config.subscriptions!).join(', ')
        console.log(`  • Subscriptions:       ${GREEN}${subCount} active${RESET} (${subList})`)
    } else {
        console.log(
            `  • Subscriptions:       ${GRAY}None detected${RESET} (Run "december auth import")`
        )
    }

    if (authStatus.hasDecember) {
        console.log(
            `  • December Cloud:      ${GREEN}Connected${RESET} ${config.email ? `(${config.email})` : ''}`
        )
    } else {
        console.log(`  • December Cloud:      ${GRAY}Not logged in${RESET} (Run "december login")`)
    }

    const providerCount = config.providers ? Object.keys(config.providers).length : 0
    if (providerCount > 0) {
        console.log(
            `  • BYOK Providers:      ${GREEN}${providerCount} configured${RESET} (Active: ${config.activeProvider || 'none'}, Model: ${config.activeModel || 'default'})`
        )
    } else {
        console.log(`  • BYOK Providers:      ${GRAY}None configured${RESET}`)
    }

    console.log(
        `  • Auth Priority:       ${GRAY}${config.authPriority || authStatus.authPriority}${RESET}`
    )
    console.log('')
}
