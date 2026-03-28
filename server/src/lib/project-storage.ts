import {
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
} from '@aws-sdk/client-s3'

import { s3 } from '../config/s3'

const BUCKET = process.env.S3_BUCKET!

function normalizePath(path: string) {
    return path.replace(/^\/+/, '')
}

export function currentKey(projectId: string, path: string) {
    return `projects/${projectId}/frontend/current/${normalizePath(path)}`
}

export function currentPrefix(projectId: string) {
    return `projects/${projectId}/frontend/current/`
}

export function versionKey(projectId: string, versionId: string, path: string) {
    return `projects/${projectId}/frontend/versions/${versionId}/${normalizePath(path)}`
}

export function versionPrefix(projectId: string, versionId: string) {
    return `projects/${projectId}/frontend/versions/${versionId}/`
}

export function projectPrefix(projectId: string) {
    return `projects/${projectId}/`
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
