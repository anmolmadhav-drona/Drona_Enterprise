import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME

  if (!bucket) {
    throw new Error('AWS_S3_BUCKET_NAME is not configured')
  }

  return bucket
}

function getS3Client(): S3Client {
  const region = process.env.AWS_REGION

  if (!region) {
    throw new Error('AWS_REGION is not configured')
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS S3 credentials are not configured')
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
) {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await client.send(command)

  return {
    bucket,
    key,
  }
}

export async function getS3DownloadUrl(
  key: string,
  expiresIn = 3600
) {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(client, command, {
    expiresIn,
  })
}

export async function getS3FileType(key: string) {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  const result = await client.send(command)

  return result.ContentType || null
}

export async function deleteFromS3(key: string) {
  const client = getS3Client()
  const bucket = getBucket()

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  await client.send(command)
}