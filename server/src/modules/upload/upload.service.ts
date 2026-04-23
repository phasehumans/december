type UploadRepo = {
    userId: string
    repoURL: string
}

const uploadRepo = async (data: UploadRepo) => {
    const { userId, repoURL } = data
}

const uploadZip = async () => {}

export const uploadService = {
    uploadRepo,
    uploadZip,
}
