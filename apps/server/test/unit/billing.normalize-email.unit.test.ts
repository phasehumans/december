import { describe, expect, it } from 'bun:test'

import { normalizeEmail } from '../../src/modules/billing/billing.utils'

// #624 part 2: one free credit request per normalized address
describe('normalizeEmail', () => {
    it('lowercases every address', () => {
        expect(normalizeEmail('Dev.Person@Example.COM')).toBe('dev.person@example.com')
    })

    it('removes dots and the +tag for gmail, and treats googlemail as gmail', () => {
        expect(normalizeEmail('a.b+x@gmail.com')).toBe('ab@gmail.com')
        expect(normalizeEmail('ab@googlemail.com')).toBe('ab@gmail.com')
        expect(normalizeEmail(' A.B+promo+2@GoogleMail.com ')).toBe('ab@gmail.com')
    })

    it('keeps dots and +tags for other providers', () => {
        expect(normalizeEmail('a.b+x@outlook.com')).toBe('a.b+x@outlook.com')
    })
})
