// the rules of a user's secret (the Secrets settings page). the server checks every save
// with them, the web checks a form before it sends it, and the worker drops a name that
// breaks them before it puts a value in a sandbox.

/** the longest name, in characters */
export const SECRET_NAME_MAX = 128
/** the longest value, in characters. far below the 128 KiB limit of one environment value */
export const SECRET_VALUE_MAX = 16 * 1024
/** the longest note, in characters */
export const SECRET_NOTE_MAX = 200
/** the most secrets a user keeps, over all repositories. keeps the sandbox environment small */
export const SECRETS_PER_USER_MAX = 100
/** the most secrets in one bulk save */
export const SECRETS_BULK_MAX = 100

/** a new name: capital letters, digits and _, and not a digit first */
const SECRET_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/
/** a name a shell can export, in any letter case (older rows) */
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

// names the shell, the loader, git or December use in the sandbox. a secret with one of
// these names would change how the sandbox runs, or what December's own commands do
const RESERVED_NAMES = new Set([
    '_',
    'BASH_ENV',
    'BASHOPTS',
    'CDPATH',
    'COLORTERM',
    'ENV',
    'GIT_ASKPASS',
    'GIT_DIR',
    'GIT_EXEC_PATH',
    'GIT_INDEX_FILE',
    'GIT_SSH',
    'GIT_SSH_COMMAND',
    'GIT_TERMINAL_PROMPT',
    'GIT_WORK_TREE',
    'GLOBIGNORE',
    'HISTFILE',
    'HOME',
    'HOSTNAME',
    'IFS',
    'LANG',
    'LC_ALL',
    'LOGNAME',
    'MAIL',
    'OLDPWD',
    'PATH',
    'PROMPT_COMMAND',
    'PS1',
    'PS2',
    'PS3',
    'PS4',
    'PWD',
    'SHELL',
    'SHELLOPTS',
    'SSH_ASKPASS',
    'SSH_AUTH_SOCK',
    'TERM',
    'TMPDIR',
    'USER',
])
const RESERVED_PREFIXES = ['BASH_FUNC_', 'DECEMBER_', 'E2B_', 'GIT_CONFIG', 'LD_']

/** true for a name the sandbox keeps for itself (PATH, LD_PRELOAD, DECEMBER_...) */
export const isReservedSecretName = (name: string): boolean => {
    const upper = name.toUpperCase()
    return RESERVED_NAMES.has(upper) || RESERVED_PREFIXES.some((prefix) => upper.startsWith(prefix))
}

/** why a new name is refused, or null when it is good */
export const checkSecretName = (name: string): string | null => {
    if (!name) return 'Add a name.'
    if (name.length > SECRET_NAME_MAX) return `Use ${SECRET_NAME_MAX} characters or fewer.`
    if (!SECRET_NAME_PATTERN.test(name)) {
        return /^[0-9]/.test(name)
            ? 'Start the name with a letter or _.'
            : 'Use only A-Z, 0-9 and _ in the name.'
    }
    if (isReservedSecretName(name)) return `${name} is a system name. Use a different name.`
    return null
}

/** why a value is refused, or null when it is good */
export const checkSecretValue = (value: string): string | null => {
    if (!value.trim()) return 'Add a value.'
    if (value.length > SECRET_VALUE_MAX) {
        return `Use ${SECRET_VALUE_MAX.toLocaleString('en-US')} characters or fewer.`
    }
    // an environment value cannot hold a NUL character
    if (value.includes('\0')) return 'Remove the NUL characters from the value.'
    return null
}

/**
 * true when a stored secret may go into a sandbox: a name a shell can export that is not a
 * system name. Older rows were saved before the name rules, so the letter case is free here.
 */
export const isSandboxSecretName = (name: string): boolean =>
    ENV_NAME_PATTERN.test(name) && name.length <= SECRET_NAME_MAX && !isReservedSecretName(name)

/** a typed name in the form of a secret name: capital letters, and _ for other characters */
export const toSecretName = (raw: string): string =>
    raw
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')

export type EnvEntry = { name: string; value: string; line: number }
export type EnvProblem = { line: number; message: string }
export type ParsedEnv = { entries: EnvEntry[]; problems: EnvProblem[] }

// the end of a quoted value: the next quote that no backslash escapes (double quotes only)
const findClosingQuote = (text: string, quote: string): number => {
    if (quote !== '"') return text.indexOf(quote)
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\\') i++
        else if (text[i] === '"') return i
    }
    return -1
}

const DOUBLE_QUOTE_ESCAPES: Record<string, string> = {
    n: '\n',
    r: '\r',
    t: '\t',
    '"': '"',
    '\\': '\\',
}

/**
 * The secrets of a pasted .env file. Reads `NAME=value`, `export NAME=value`, comments
 * (`# ...`, and ` # ...` after a value with no quotes), and values in "double", 'single'
 * or `back` quotes, which can go over more than one line. In double quotes \n, \t, \" and
 * \\ are read as in dotenv. A name is put in the form of a secret name (`my-key` is
 * MY_KEY). A line with no value is skipped. When a name is there two times, the last value
 * wins. Lines that cannot be read come back as problems, with their line number.
 */
export const parseEnvText = (text: string): ParsedEnv => {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
    const byName = new Map<string, EnvEntry>()
    const problems: EnvProblem[] = []

    for (let i = 0; i < lines.length; i++) {
        const lineNumber = i + 1
        let line = (lines[i] ?? '').trimStart()
        if (!line.trim() || line.startsWith('#')) continue
        if (/^export\s/.test(line)) line = line.slice(6).trimStart()

        const eq = line.indexOf('=')
        if (eq <= 0) {
            problems.push({ line: lineNumber, message: 'Use NAME=value.' })
            continue
        }
        const name = toSecretName(line.slice(0, eq))
        const rest = line.slice(eq + 1).trimStart()
        const quote = rest[0]

        let value: string
        if (quote === '"' || quote === "'" || quote === '`') {
            let body = rest.slice(1)
            let close = findClosingQuote(body, quote)
            // a quoted value goes on to the next lines until its closing quote
            while (close === -1 && i + 1 < lines.length) {
                i++
                body += `\n${lines[i]}`
                close = findClosingQuote(body, quote)
            }
            if (close === -1) {
                problems.push({ line: lineNumber, message: 'Close the quote of the value.' })
                continue
            }
            value = body.slice(0, close)
            if (quote === '"') {
                value = value.replace(
                    /\\([nrt"\\])/g,
                    (_, char: string) => DOUBLE_QUOTE_ESCAPES[char] ?? char
                )
            }
        } else {
            const comment = rest.search(/\s#/)
            value = (comment === -1 ? rest : rest.slice(0, comment)).trim()
        }

        const nameProblem = checkSecretName(name)
        if (nameProblem) {
            problems.push({ line: lineNumber, message: nameProblem })
            continue
        }
        if (!value) continue
        const valueProblem = checkSecretValue(value)
        if (valueProblem) {
            problems.push({ line: lineNumber, message: valueProblem })
            continue
        }
        // the last value of a name wins, at the place of its first line
        const first = byName.get(name)
        byName.set(name, { name, value, line: first?.line ?? lineNumber })
    }

    return { entries: [...byName.values()], problems }
}
