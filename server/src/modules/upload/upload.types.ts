export type UploadedZipFile = {
    originalname: string
    mimetype: string
    buffer: Buffer
}

export type UploadRepo = {
    userId: string
    repoURL: string
}

export type ImportFromZip = {
    userId: string
    zipFile: UploadedZipFile
}

export type GetImportStatus = {
    userId: string
    importId: string
}

export type RetryImport = {
    userId: string
    importId: string
}
