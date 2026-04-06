import { describe, expect, test } from 'bun:test'

import * as authModule from '../../src/modules/auth/auth.schema'

describe('source imports', () => {
    test('can import auth module', () => {
        expect(authModule).toBeDefined()
    })
})
