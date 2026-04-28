import {
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
} from '@aws-sdk/client-s3'

import { s3 } from '../config/s3'

const BUCKET = process.env.S3_BUCKET || 'phasehumans'

function normalizePath(path: string) {
    return path.replace(/^\/+/, '')
}

export function currentKey(projectId: string, path: string) {
    return `projects/${projectId}/current-version/${normalizePath(path)}`
}

export function currentPrefix(projectId: string) {
    return `projects/${projectId}/current-version/`
}

export function versionKey(projectId: string, versionId: string, path: string) {
    return `projects/${projectId}/previous-version/${versionId}/${normalizePath(path)}`
}

export function versionPrefix(projectId: string, versionId: string) {
    return `projects/${projectId}/previous-version/${versionId}/`
}

export function projectPrefix(projectId: string) {
    return `projects/${projectId}/`
}

export function importPrefix(userId: string, importId: string) {
    return `imports/${userId}/${importId}/source/`
}

export function importObjectKey(userId: string, importId: string, path: string) {
    return `${importPrefix(userId, importId)}${normalizePath(path)}`
}

export function storageBucket() {
    return BUCKET
}

export function assetKey(projectId: string, path: string) {
    return `projects/${projectId}/assets/${normalizePath(path)}`
}

export function assetPrefix(projectId: string) {
    return `projects/${projectId}/assets/`
}

export function temporaryCanvasAssetKey(userId: string, path: string) {
    return `users/${userId}/canvas-temp/${normalizePath(path)}`
}

export function temporaryCanvasAssetPrefix(userId: string) {
    return `users/${userId}/canvas-temp/`
}

export async function putTextFile({
    key,
    content,
    contentType = 'text/plain; charset=utf-8',
}: {
    key: string
    content: string
    contentType?: string
}) {
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: content,
            ContentType: contentType,
        })
    )
}

export async function getTextFile(key: string) {
    const result = await s3.send(
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    )

    return await result.Body?.transformToString()
}

export async function putBinaryFile({
    key,
    content,
    contentType,
}: {
    key: string
    content: Uint8Array | Buffer
    contentType?: string
}) {
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: content,
            ...(contentType ? { ContentType: contentType } : {}),
        })
    )
}

export async function getBinaryFile(key: string) {
    try {
        const result = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        )

        const body = await result.Body?.transformToByteArray()

        if (!body) {
            return null
        }

        return {
            body,
            contentType: result.ContentType,
        }
    } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : ''

        if (message.includes('nosuchkey') || message.includes('not found')) {
            return null
        }

        throw error
    }
}

export async function deleteObject(key: string) {
    await s3.send(
        new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    )
}

export async function deletePrefix(prefix: string) {
    const objects = await listPrefix(prefix)

    await Promise.all(
        objects
            .map((object) => object.Key)
            .filter((key): key is string => Boolean(key))
            .map((key) => deleteObject(key))
    )
}

export async function listPrefix(prefix: string) {
    const result = await s3.send(
        new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
        })
    )

    return result.Contents ?? []
}
