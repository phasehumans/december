import { describe, expect, test } from 'bun:test'

import { startPreviewSchema, previewIdParamSchema } from '../../src/modules/runtime/runtime.schema'

describe('runtime schemas', () => {
    test('startPreviewSchema validation', () => {
        const valid = startPreviewSchema.safeParse({
            projectId: crypto.randomUUID(),
            versionId: crypto.randomUUID(),
        })
        expect(valid.success).toBe(true)

        const invalid = startPreviewSchema.safeParse({
            projectId: 'not-a-uuid',
        })
        expect(invalid.success).toBe(false)
    })

    test('previewIdParamSchema validation', () => {
        const valid = previewIdParamSchema.safeParse({
            id: crypto.randomUUID(),
        })
        expect(valid.success).toBe(true)
    })
})
