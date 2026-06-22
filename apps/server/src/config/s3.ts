import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'

import { env } from '../env'

const S3_BUCKET = env.S3_BUCKET

export const s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
    },
})

export async function ensureStorageBucket() {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }))
        console.log(`[s3] bucket "${S3_BUCKET}" exists`)
    } catch (err: any) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
            console.log(`[s3] bucket "${S3_BUCKET}" not found, creating...`)
            await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }))
            console.log(`[s3] bucket "${S3_BUCKET}" created`)
        } else {
            console.error(`[s3] failed to check bucket "${S3_BUCKET}":`, err)
            throw err
        }
    }
}
