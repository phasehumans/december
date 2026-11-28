import { describe, expect, it } from 'bun:test'

import {
    SECRET_NAME_MAX,
    SECRET_VALUE_MAX,
    checkSecretName,
    checkSecretValue,
    isReservedSecretName,
    isSandboxSecretName,
    parseEnvText,
    toSecretName,
} from '../../src/secrets'

const pairs = (text: string) => parseEnvText(text).entries.map((e) => [e.name, e.value])

describe('secret names', () => {
    it('takes capital letters, digits and _, not a digit first', () => {
        for (const name of ['A', '_A', 'API_KEY', 'KEY_2', 'X'.repeat(SECRET_NAME_MAX)]) {
            expect(checkSecretName(name)).toBeNull()
        }
    })

    it('says why a name is refused', () => {
        expect(checkSecretName('')).toBe('Add a name.')
        expect(checkSecretName('X'.repeat(SECRET_NAME_MAX + 1))).toBe(
            `Use ${SECRET_NAME_MAX} characters or fewer.`
        )
        expect(checkSecretName('2FA')).toBe('Start the name with a letter or _.')
        expect(checkSecretName('api_key')).toBe('Use only A-Z, 0-9 and _ in the name.')
        expect(checkSecretName('A-B')).toBe('Use only A-Z, 0-9 and _ in the name.')
        expect(checkSecretName('PATH')).toBe('PATH is a system name. Use a different name.')
    })

    it('keeps the names of the shell, the loader, git and December', () => {
        for (const name of [
            'PATH',
            'HOME',
            'IFS',
            'BASH_ENV',
            'PS4',
            'LD_PRELOAD',
            'LD_AUDIT',
            'DECEMBER_RUN',
            'E2B_ACCESS_TOKEN',
            'GIT_ASKPASS',
            'GIT_CONFIG_COUNT',
            'BASH_FUNC_ls%%',
            '_',
        ]) {
            expect(isReservedSecretName(name)).toBe(true)
        }
        expect(isReservedSecretName('ld_preload')).toBe(true)
        for (const name of ['MY_PATH', 'GITHUB_TOKEN', 'NODE_ENV', 'DATABASE_URL', 'GIT_TOKEN']) {
            expect(isReservedSecretName(name)).toBe(false)
        }
    })

    it('lets an old row of any letter case into a sandbox, but no system name', () => {
        expect(isSandboxSecretName('lower_case')).toBe(true)
        expect(isSandboxSecretName('API_KEY')).toBe(true)
        for (const name of ['PATH', 'path', 'LD_PRELOAD', 'BAD NAME', '1A', '', 'A;B']) {
            expect(isSandboxSecretName(name)).toBe(false)
        }
    })

    it('puts a typed name in the form of a secret name', () => {
        expect(toSecretName(' stripe key ')).toBe('STRIPE_KEY')
        expect(toSecretName('my-api.key')).toBe('MY_API_KEY')
        expect(toSecretName('API_KEY')).toBe('API_KEY')
    })
})

describe('secret values', () => {
    it('takes a value up to the limit, with any characters but NUL', () => {
        expect(checkSecretValue('a')).toBeNull()
        expect(checkSecretValue(`it's "q" $x\nline`)).toBeNull()
        expect(checkSecretValue('a'.repeat(SECRET_VALUE_MAX))).toBeNull()
    })

    it('says why a value is refused', () => {
        expect(checkSecretValue('')).toBe('Add a value.')
        expect(checkSecretValue('  \n')).toBe('Add a value.')
        expect(checkSecretValue('a'.repeat(SECRET_VALUE_MAX + 1))).toBe(
            'Use 16,384 characters or fewer.'
        )
        expect(checkSecretValue('a\0b')).toBe('Remove the NUL characters from the value.')
    })
})

describe('parseEnvText', () => {
    it('reads NAME=value lines and skips blank lines and comments', () => {
        expect(pairs('A=1\n\n# a comment\n   # another\nB=two\n')).toEqual([
            ['A', '1'],
            ['B', 'two'],
        ])
    })

    it('reads Windows line ends and a BOM', () => {
        expect(pairs('\uFEFFA=1\r\nB=2\r\n')).toEqual([
            ['A', '1'],
            ['B', '2'],
        ])
    })

    it('takes an export prefix and spaces around =', () => {
        expect(pairs('export A=1\nexport\tB = 2\n  C =3')).toEqual([
            ['A', '1'],
            ['B', '2'],
            ['C', '3'],
        ])
    })

    it('keeps a name that only starts with export', () => {
        expect(pairs('EXPORTER=1')).toEqual([['EXPORTER', '1']])
    })

    it('keeps an = in the value', () => {
        expect(pairs('URL=postgres://u:p@h/db?a=1&b=2')).toEqual([
            ['URL', 'postgres://u:p@h/db?a=1&b=2'],
        ])
    })

    it('drops a comment after a value with no quotes, but keeps a # in the value', () => {
        expect(pairs('A=1 # the first\nB=abc#def\nC=x\t# tab')).toEqual([
            ['A', '1'],
            ['B', 'abc#def'],
            ['C', 'x'],
        ])
    })

    it('reads double quotes with escapes, and single and back quotes as they are', () => {
        expect(
            pairs(
                'A="hello world"\nB=\'it is # not a comment\'\nC="line\\nnext \\"q\\" \\\\ \\t"\nD=\'raw\\n\'\nE=`back $x`'
            )
        ).toEqual([
            ['A', 'hello world'],
            ['B', 'it is # not a comment'],
            ['C', 'line\nnext "q" \\ \t'],
            ['D', 'raw\\n'],
            ['E', 'back $x'],
        ])
    })

    it('drops a comment after a closing quote', () => {
        expect(pairs('A="1" # note')).toEqual([['A', '1']])
    })

    it('reads a quoted value over more than one line', () => {
        const text = 'KEY="-----BEGIN KEY-----\nabc\n-----END KEY-----"\nNEXT=1'
        expect(pairs(text)).toEqual([
            ['KEY', '-----BEGIN KEY-----\nabc\n-----END KEY-----'],
            ['NEXT', '1'],
        ])
        expect(parseEnvText(text).entries[1]?.line).toBe(4)
    })

    it('says which line has a quote that is not closed', () => {
        const parsed = parseEnvText('A=1\nB="open\nC=3')
        expect(parsed.problems).toEqual([{ line: 2, message: 'Close the quote of the value.' }])
        expect(parsed.entries.map((e) => e.name)).toEqual(['A'])
    })

    it('says which line has no =', () => {
        expect(parseEnvText('A=1\njust text\n=nothing').problems).toEqual([
            { line: 2, message: 'Use NAME=value.' },
            { line: 3, message: 'Use NAME=value.' },
        ])
    })

    it('puts names in the form of secret names', () => {
        expect(pairs('my-key=1\napi.url=2\nlower=3')).toEqual([
            ['MY_KEY', '1'],
            ['API_URL', '2'],
            ['LOWER', '3'],
        ])
    })

    it('says which line has a system name or a bad name', () => {
        const parsed = parseEnvText('PATH=/bin\n1BAD=x\nOK=1\nexport LD_PRELOAD=x')
        expect(parsed.problems).toEqual([
            { line: 1, message: 'PATH is a system name. Use a different name.' },
            { line: 2, message: 'Start the name with a letter or _.' },
            { line: 4, message: 'LD_PRELOAD is a system name. Use a different name.' },
        ])
        expect(parsed.entries.map((e) => e.name)).toEqual(['OK'])
    })

    it('says which line has a value that is too long', () => {
        const parsed = parseEnvText(`BIG=${'a'.repeat(SECRET_VALUE_MAX + 1)}`)
        expect(parsed.problems[0]?.line).toBe(1)
        expect(parsed.entries).toEqual([])
    })

    it('skips a name with no value', () => {
        expect(parseEnvText('EMPTY=\nQUOTED=""\nA=1')).toEqual({
            entries: [{ name: 'A', value: '1', line: 3 }],
            problems: [],
        })
    })

    it('keeps the last value of a name that is there two times, at its first place', () => {
        expect(parseEnvText('A=1\nB=2\nA=3')).toEqual({
            entries: [
                { name: 'A', value: '3', line: 1 },
                { name: 'B', value: '2', line: 2 },
            ],
            problems: [],
        })
    })

    it('gives nothing for an empty text', () => {
        expect(parseEnvText('')).toEqual({ entries: [], problems: [] })
        expect(parseEnvText('\n\n# only comments\n')).toEqual({ entries: [], problems: [] })
    })
})
