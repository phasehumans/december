import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'

const S3_BUCKET = process.env.S3_BUCKET || 'december-storage'

export const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || 'http://127.0.0.1:9000',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE
        ? process.env.S3_FORCE_PATH_STYLE === 'true'
        : true,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'decemberadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minio@2004',
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
