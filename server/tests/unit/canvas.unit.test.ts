import * as cryptoModule from 'crypto'

import { beforeEach, describe, expect, it, mock } from 'bun:test'

const storedObjects = new Map<string, { body: Uint8Array; contentType?: string }>()

const getBinaryFileMock = mock(async (key: string) => storedObjects.get(key) ?? null)
const putBinaryFileMock = mock(
    async ({
        key,
        content,
        contentType,
    }: {
        key: string
        content: Uint8Array | Buffer
        contentType?: string
    }) => {
        storedObjects.set(key, {
            body: Uint8Array.from(content),
            ...(contentType ? { contentType } : {}),
        })
    }
)
const deleteObjectMock = mock(async (key: string) => {
    storedObjects.delete(key)
})

mock.module('crypto', () => ({
    ...cryptoModule,
    randomUUID: () => 'fixed-uuid',
}))

mock.module('../../src/lib/project-storage', () => ({
    assetKey: (projectId: string, assetPath: string) =>
        `projects/${projectId}/assets/${assetPath.replace(/^\/+/, '')}`,
    assetPrefix: (projectId: string) => `projects/${projectId}/assets/`,
    deleteObject: deleteObjectMock,
    getBinaryFile: getBinaryFileMock,
    putBinaryFile: putBinaryFileMock,
}))

const { webClipRequestSchema } = await import('../../src/modules/canvas/canvas.schema')
const { hydrateCanvasDocument, persistCanvasDocument } =
    await import('../../src/modules/canvas/canvas.persistence')

describe('canvas.schema', () => {
    it('accepts a valid https URL with an optional project id', () => {
        const result = webClipRequestSchema.safeParse({
            url: 'https://example.com/article',
            projectId: '550e8400-e29b-41d4-a716-446655440000',
        })

        expect(result.success).toBe(true)
    })

    it('rejects URLs that are not http or https', () => {
        const result = webClipRequestSchema.safeParse({
            url: 'ftp://example.com/file.txt',
        })

        expect(result.success).toBe(false)
    })

    it('rejects an invalid project id', () => {
        const result = webClipRequestSchema.safeParse({
            url: 'https://example.com/article',
            projectId: 'not-a-uuid',
        })

        expect(result.success).toBe(false)
    })
})

describe('canvas.persistence', () => {
    beforeEach(() => {
        storedObjects.clear()
        getBinaryFileMock.mockClear()
        putBinaryFileMock.mockClear()
        deleteObjectMock.mockClear()
    })

    it('persists inline image content into project storage', async () => {
        const result = await persistCanvasDocument({
            projectId: 'project-1',
            userId: 'user-1',
            versionId: 'version-1',
            canvasState: {
                items: [
                    {
                        id: 'image-1',
                        type: 'image',
                        x: 10,
                        y: 20,
                        content: 'data:image/png;base64,SGVsbG8=',
                    },
                ],
                connections: [],
                pan: { x: 1, y: 2 },
                scale: 125,
                hasInteracted: true,
            },
        })

        const expectedKey =
            'projects/project-1/assets/canvas/version-1/upload/image-1-fixed-uuid.png'

        expect(putBinaryFileMock).toHaveBeenCalledTimes(1)
        expect(result.canvasAssetManifestJson).toEqual([
            {
                itemId: 'image-1',
                key: expectedKey,
                contentType: 'image/png',
                size: 5,
                kind: 'upload',
            },
        ])
        expect(result.canvasStateJson.items[0]).toMatchObject({
            id: 'image-1',
            type: 'image',
            x: 10,
            y: 20,
            assetKey: expectedKey,
            assetSource: 'project',
            assetContentType: 'image/png',
            assetKind: 'upload',
        })
        expect(result.canvasStateJson.items[0]?.content).toBeUndefined()
        expect(Buffer.from(storedObjects.get(expectedKey)!.body).toString()).toBe('Hello')
    })

    it('promotes temporary image assets into project storage and deletes the temporary object', async () => {
        const temporaryKey = 'users/user-1/canvas-temp/web-clips/example-com/section-1.png'
        storedObjects.set(temporaryKey, {
            body: Uint8Array.from([1, 2, 3, 4]),
            contentType: 'image/webp',
        })

        const result = await persistCanvasDocument({
            projectId: 'project-1',
            userId: 'user-1',
            versionId: 'version-2',
            canvasState: {
                items: [
                    {
                        id: 'image-2',
                        type: 'image',
                        x: 0,
                        y: 0,
                        assetKey: temporaryKey,
                        assetSource: 'temporary',
                        assetKind: 'web-clip',
                    },
                ],
                connections: [],
                pan: { x: 0, y: 0 },
                scale: 100,
                hasInteracted: false,
            },
        })

        const expectedKey =
            'projects/project-1/assets/canvas/version-2/web-clip/image-2-fixed-uuid.webp'

        expect(deleteObjectMock).toHaveBeenCalledWith(temporaryKey)
        expect(result.canvasAssetManifestJson).toEqual([
            {
                itemId: 'image-2',
                key: expectedKey,
                contentType: 'image/webp',
                size: 4,
                kind: 'web-clip',
            },
        ])
        expect(result.canvasStateJson.items[0]).toMatchObject({
            assetKey: expectedKey,
            assetSource: 'project',
            assetContentType: 'image/webp',
            assetKind: 'web-clip',
        })
        expect(storedObjects.has(temporaryKey)).toBe(false)
    })

    it('reuses an existing project asset without uploading a new object', async () => {
        const existingKey = 'projects/project-1/assets/canvas/version-3/upload/image-3.png'
        storedObjects.set(existingKey, {
            body: Uint8Array.from([9, 8, 7]),
            contentType: 'image/png',
        })

        const result = await persistCanvasDocument({
            projectId: 'project-1',
            userId: 'user-1',
            versionId: 'version-3',
            canvasState: {
                items: [
                    {
                        id: 'image-3',
                        type: 'image',
                        x: 5,
                        y: 6,
                        assetKey: existingKey,
                        assetSource: 'project',
                        assetContentType: 'image/png',
                    },
                ],
                connections: [],
                pan: { x: 0, y: 0 },
                scale: 100,
                hasInteracted: false,
            },
        })

        expect(putBinaryFileMock).not.toHaveBeenCalled()
        expect(result.canvasAssetManifestJson).toEqual([
            {
                itemId: 'image-3',
                key: existingKey,
                contentType: 'image/png',
                size: 3,
                kind: 'upload',
            },
        ])
        expect(result.canvasStateJson.items[0]).toMatchObject({
            assetKey: existingKey,
            assetSource: 'project',
            assetContentType: 'image/png',
            assetKind: 'upload',
        })
    })

    it('removes unresolved image asset metadata when nothing can be persisted', async () => {
        const result = await persistCanvasDocument({
            projectId: 'project-1',
            userId: 'user-1',
            versionId: 'version-4',
            canvasState: {
                items: [
                    {
                        id: 'image-4',
                        type: 'image',
                        x: 0,
                        y: 0,
                        assetKey: 'users/user-1/canvas-temp/missing.png',
                        assetSource: 'temporary',
                        assetContentType: 'image/png',
                        assetKind: 'upload',
                    },
                ],
                connections: [],
                pan: { x: 0, y: 0 },
                scale: 100,
                hasInteracted: false,
            },
        })

        expect(result.canvasAssetManifestJson).toEqual([])
        expect(result.canvasStateJson.items[0]).toMatchObject({
            id: 'image-4',
            type: 'image',
            x: 0,
            y: 0,
        })
        expect(result.canvasStateJson.items[0]?.assetKey).toBeUndefined()
        expect(result.canvasStateJson.items[0]?.assetSource).toBeUndefined()
        expect(result.canvasStateJson.items[0]?.assetContentType).toBeUndefined()
        expect(result.canvasStateJson.items[0]?.assetKind).toBeUndefined()
    })

    it('hydrates stored image assets back into data URLs using manifest metadata', async () => {
        const storedKey = 'projects/project-1/assets/canvas/version-5/web-clip/image-5.webp'
        storedObjects.set(storedKey, {
            body: Uint8Array.from(Buffer.from('clip')),
        })

        const result = await hydrateCanvasDocument({
            canvasState: {
                items: [
                    {
                        id: 'image-5',
                        type: 'image',
                        x: 0,
                        y: 0,
                        assetKey: storedKey,
                    },
                ],
                connections: [],
                pan: { x: 0, y: 0 },
                scale: 100,
                hasInteracted: false,
            },
            canvasAssetManifest: [
                {
                    itemId: 'image-5',
                    key: storedKey,
                    contentType: 'image/webp',
                    size: 4,
                    kind: 'web-clip',
                },
            ],
        })

        expect(result.items[0]).toMatchObject({
            id: 'image-5',
            assetKey: storedKey,
            assetSource: 'project',
            assetContentType: 'image/webp',
            assetKind: 'web-clip',
            content: 'data:image/webp;base64,Y2xpcA==',
        })
    })
})
