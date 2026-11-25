/**
 * The user's secrets inside a sandbox (#637 section 5).
 *
 * The secrets of a run are written to one file that the shell loads. The file is written
 * again on each run, so a sandbox that is reused or resumed gets the values of today.
 * A value is never put in a command line and never printed to a log.
 */

import { shellQuote } from './shell-quote'

export type SandboxSecret = { key: string; value: string }

export type ApplySecretsInput = {
    sandbox: any
    secrets?: SandboxSecret[]
    /** other environment values of the sandbox; a secret with the same name wins */
    envs?: Record<string, string>
}

export const SECRETS_FILE = '/home/user/.december_secrets'

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

// the line in .bashrc that loads the file; added one time
const SOURCE_LINE = `[ -f ${SECRETS_FILE} ] && . ${SECRETS_FILE}`
const ENSURE_SOURCE_COMMAND =
    `chmod 600 ${SECRETS_FILE}; touch /home/user/.bashrc; ` +
    `grep -qxF '${SOURCE_LINE}' /home/user/.bashrc || echo '${SOURCE_LINE}' >> /home/user/.bashrc`

// the values each sandbox got last, for the commands the agent runs
const envsBySandbox = new WeakMap<object, Record<string, string>>()

/** the secrets as environment values. a name that a shell cannot export is dropped */
export const toSecretEnvs = (secrets: SandboxSecret[] | undefined): Record<string, string> => {
    const envs: Record<string, string> = {}
    if (!Array.isArray(secrets)) return envs
    for (const secret of secrets) {
        if (!secret?.key || !secret.value || !ENV_NAME.test(secret.key)) continue
        envs[secret.key] = secret.value
    }
    return envs
}

/** one `export NAME='value'` line for each value. single quotes keep every character as it is */
export const buildSecretsFile = (envs: Record<string, string>): string =>
    Object.entries(envs)
        .filter(([name]) => ENV_NAME.test(name))
        .map(([name, value]) => `export ${name}=${shellQuote(String(value))}\n`)
        .join('')

/** the values to add to a command in this sandbox, or undefined when it has none */
export const secretEnvsOf = (sandbox: unknown): Record<string, string> | undefined =>
    sandbox && typeof sandbox === 'object' ? envsBySandbox.get(sandbox) : undefined

/**
 * Write the secrets of this run into the sandbox and make the shell load them.
 * Safe to call on each run. Returns false when the sandbox has no file api or the write fails.
 */
export const applySecretsToSandbox = async (data: ApplySecretsInput): Promise<boolean> => {
    const { sandbox, secrets, envs } = data
    if (!sandbox || typeof sandbox.files?.write !== 'function') return false

    const values = { ...(envs ?? {}), ...toSecretEnvs(secrets) }
    if (Object.keys(values).length > 0) envsBySandbox.set(sandbox, values)
    else envsBySandbox.delete(sandbox)

    try {
        await sandbox.files.write(SECRETS_FILE, buildSecretsFile(values))
        if (typeof sandbox.commands?.run === 'function') {
            await sandbox.commands.run(ENSURE_SOURCE_COMMAND, { cwd: '/home/user' })
        }
        return true
    } catch {
        // the error text is not printed: it could hold a part of the file
        console.warn('[SandboxSecrets] could not write the secrets file in the sandbox')
        return false
    }
}
