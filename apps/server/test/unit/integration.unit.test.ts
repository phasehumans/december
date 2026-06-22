import { describe, expect, test } from 'bun:test'
import {
    createGithubRepoSchema,
    syncGithubRepoSchema,
} from '../../src/modules/integration/integration.schema'

describe('integration schemas', () => {
    test('createGithubRepoSchema validation', () => {
        const valid = createGithubRepoSchema.safeParse({
            name: 'my-awesome-repo',
            private: true,
            description: 'My repo description',
        })
        expect(valid.success).toBe(true)

        const invalidName = createGithubRepoSchema.safeParse({
            name: 'my awesome repo',
        })
        expect(invalidName.success).toBe(false)
    })

    test('syncGithubRepoSchema validation', () => {
        const valid = syncGithubRepoSchema.safeParse({
            commitMessage: 'First commit',
        })
        expect(valid.success).toBe(true)
    })
})
