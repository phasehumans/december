import { randomUUID } from 'crypto'
import { z } from 'zod'
import {
    assetKey,
    assetPrefix,
    deleteObject,
    getBinaryFile,
    putBinaryFile,
} from '../../lib/project-storage'

const canvasItemTypeSchema = z.enum([
    'note',
    'image',
    'link',
    'frame',
    'square',
    'circle',
    'line',
    'arrow',
    'pen',
    'text',
])

const canvasPointSchema = z.object({
    x: z.number(),
    y: z.number(),
})

const canvasAssetSourceSchema = z.enum(['temporary', 'project'])
const canvasAssetKindSchema = z.enum(['upload', 'web-clip'])

export const canvasItemSchema = z.object({
    id: z.string().min(1),
    type: canvasItemTypeSchema,
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    content: z.string().optional(),
    color: z.string().optional(),
    points: z.array(canvasPointSchema).optional(),
    parentId: z.string().optional(),
    assetKey: z.string().optional(),
    assetSource: canvasAssetSourceSchema.optional(),
    assetContentType: z.string().optional(),
    assetKind: canvasAssetKindSchema.optional(),
})

export const canvasConnectionSchema = z.object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    fromSide: z.enum(['left', 'right']),
    toSide: z.enum(['left', 'right']),
})

export const canvasDocumentSchema = z.object({
    items: z.array(canvasItemSchema).default([]),
    connections: z.array(canvasConnectionSchema).default([]),
    pan: canvasPointSchema.default({ x: 0, y: 0 }),
    scale: z.number().default(100),
    hasInteracted: z.boolean().default(false),
})

export type CanvasDocument = z.infer<typeof canvasDocumentSchema>

type CanvasAssetManifestEntry = {
    itemId: string
    key: string
    contentType?: string
    size: number
    kind: z.infer<typeof canvasAssetKindSchema>
}

const EMPTY_CANVAS_DOCUMENT: CanvasDocument = {
    items: [],
    connections: [],
    pan: { x: 0, y: 0 },
    scale: 100,
    hasInteracted: false,
}

const DATA_URL_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/s

const contentTypeToExtension = (contentType?: string | null) => {
    switch ((contentType || '').toLowerCase()) {
        case 'image/png':
            return 'png'
        case 'image/jpeg':
            return 'jpg'
        case 'image/webp':
            return 'webp'
        case 'image/gif':
            return 'gif'
        case 'image/svg+xml':
            return 'svg'
        default:
            return 'bin'
    }
}

const parseDataUrl = (value: string) => {
    const match = DATA_URL_PATTERN.exec(value)

    if (!match) {
        return null
    }

    const [, contentType = 'application/octet-stream', isBase64, payload = ''] = match
    const buffer = isBase64
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload))

    return {
        contentType,
        buffer,
    }
}

const toDataUrl = (contentType: string, bytes: Uint8Array) =>
    `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`

const normalizeCanvasDocument = (canvasState?: CanvasDocument | null): CanvasDocument => {
    const parsed = canvasDocumentSchema.safeParse(canvasState)
    return parsed.success ? parsed.data : EMPTY_CANVAS_DOCUMENT
}

const persistImageAsset = async ({
    projectId,
    userId,
    versionId,
    item,
}: {
    projectId: string
    userId: string
    versionId: string
    item: CanvasDocument['items'][number]
}) => {
    const projectAssetPrefix = assetPrefix(projectId)
    const preferredKind = item.assetKind ?? 'upload'

    if (
        item.assetKey &&
        item.assetSource === 'project' &&
        item.assetKey.startsWith(projectAssetPrefix)
    ) {
        const existingAsset = await getBinaryFile(item.assetKey)

        if (existingAsset) {
            return {
                key: item.assetKey,
                contentType: item.assetContentType ?? existingAsset.contentType,
                size: existingAsset.body.byteLength,
                kind: preferredKind,
            }
        }
    }

    if (item.assetKey && item.assetSource === 'temporary') {
        const temporaryAsset = await getBinaryFile(item.assetKey)

        if (temporaryAsset) {
            const nextContentType =
                item.assetContentType ?? temporaryAsset.contentType ?? 'image/png'
            const nextKey = assetKey(
                projectId,
                `canvas/${versionId}/${preferredKind}/${item.id}-${randomUUID()}.${contentTypeToExtension(nextContentType)}`
            )

            await putBinaryFile({
                key: nextKey,
                content: temporaryAsset.body,
                contentType: nextContentType,
            })
            await deleteObject(item.assetKey).catch(() => undefined)

            return {
                key: nextKey,
                contentType: nextContentType,
                size: temporaryAsset.body.byteLength,
                kind: preferredKind,
            }
        }
    }

    if (item.content) {
        const parsedDataUrl = parseDataUrl(item.content)

        if (parsedDataUrl) {
            const nextKey = assetKey(
                projectId,
                `canvas/${versionId}/${preferredKind}/${item.id}-${randomUUID()}.${contentTypeToExtension(parsedDataUrl.contentType)}`
            )

            await putBinaryFile({
                key: nextKey,
                content: parsedDataUrl.buffer,
                contentType: parsedDataUrl.contentType,
            })

            return {
                key: nextKey,
                contentType: parsedDataUrl.contentType,
                size: parsedDataUrl.buffer.byteLength,
                kind: preferredKind,
            }
        }
    }

    return null
}

export const persistCanvasDocument = async ({
    projectId,
    userId,
    versionId,
    canvasState,
}: {
    projectId: string
    userId: string
    versionId: string
    canvasState?: CanvasDocument | null
}) => {
    const normalizedCanvas = normalizeCanvasDocument(canvasState)
    const assetManifest: CanvasAssetManifestEntry[] = []

    const items = await Promise.all(
        normalizedCanvas.items.map(async (item) => {
            if (item.type !== 'image') {
                return item
            }

            const persistedAsset = await persistImageAsset({
                projectId,
                userId,
                versionId,
                item,
            })

            if (!persistedAsset) {
                return {
                    ...item,
                    content: undefined,
                    assetKey: undefined,
                    assetSource: undefined,
                    assetContentType: undefined,
                    assetKind: undefined,
                }
            }

            assetManifest.push({
                itemId: item.id,
                key: persistedAsset.key,
                ...(persistedAsset.contentType ? { contentType: persistedAsset.contentType } : {}),
                size: persistedAsset.size,
                kind: persistedAsset.kind,
            })

            return {
                ...item,
                content: undefined,
                assetKey: persistedAsset.key,
                assetSource: 'project' as const,
                assetContentType: persistedAsset.contentType,
                assetKind: persistedAsset.kind,
            }
        })
    )

    return {
        canvasStateJson: {
            ...normalizedCanvas,
            items,
        },
        canvasAssetManifestJson: assetManifest,
    }
}

export const hydrateCanvasDocument = async ({
    canvasState,
    canvasAssetManifest,
}: {
    canvasState?: unknown
    canvasAssetManifest?: unknown
}) => {
    const normalizedCanvas = normalizeCanvasDocument(
        canvasState as CanvasDocument | null | undefined
    )
    const parsedAssetManifest = Array.isArray(canvasAssetManifest)
        ? (canvasAssetManifest as CanvasAssetManifestEntry[])
        : []
    const manifestByKey = new Map(parsedAssetManifest.map((asset) => [asset.key, asset]))

    const items = await Promise.all(
        normalizedCanvas.items.map(async (item) => {
            if (item.type !== 'image' || !item.assetKey) {
                return item
            }

            const storedAsset = await getBinaryFile(item.assetKey)

            if (!storedAsset) {
                return item
            }

            const manifestEntry = manifestByKey.get(item.assetKey)
            const contentType =
                item.assetContentType ??
                manifestEntry?.contentType ??
                storedAsset.contentType ??
                'image/png'

            return {
                ...item,
                content: toDataUrl(contentType, storedAsset.body),
                assetSource: 'project' as const,
                assetContentType: contentType,
                assetKind: item.assetKind ?? manifestEntry?.kind ?? 'upload',
            }
        })
    )

    return {
        ...normalizedCanvas,
        items,
    }
}
