import { describe, expect, it } from 'bun:test'

import { csvCell, maskEmail, toAuditCsv } from '../../src/modules/team/team.utils'

describe('team utils', () => {
    it('masks an email to its first letter and its domain', () => {
        expect(maskEmail('asha.rao@example.com')).toBe('a***@example.com')
        expect(maskEmail('x@y.io')).toBe('x***@y.io')
        expect(maskEmail('not-an-email')).toBe('***')
    })

    it('a csv cell that starts with a formula character becomes text', () => {
        expect(csvCell('=1+1')).toBe("'=1+1")
        expect(csvCell('+1')).toBe("'+1")
        expect(csvCell('-1')).toBe("'-1")
        expect(csvCell('@sum')).toBe("'@sum")
        expect(csvCell('\tcmd')).toBe("'\tcmd")
        expect(csvCell('plain')).toBe('plain')
        expect(csvCell('a-b=c')).toBe('a-b=c')
        expect(csvCell(null)).toBe('')
    })

    it('a csv cell with a comma, a quote or a new line is quoted', () => {
        expect(csvCell('a,b')).toBe('"a,b"')
        expect(csvCell('say "hi"')).toBe('"say ""hi"""')
        expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
        expect(csvCell('=A1,"x"')).toBe('"\'=A1,""x"""')
    })

    it('an audit row with no actor has empty actor cells', () => {
        const csv = toAuditCsv([
            {
                id: 'e1',
                action: 'member.left',
                target: 'kabir@example.com',
                ip: null,
                metadata: null,
                createdAt: new Date('2026-11-26T10:00:00.000Z'),
                actor: null,
            },
        ])
        expect(csv).toBe(
            'time,actor,email,action,target,ip,details\r\n' +
                '2026-11-26T10:00:00.000Z,,,member.left,kabir@example.com,,\r\n'
        )
    })
})
