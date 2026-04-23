import { prisma } from '../../config/db'
import { parseGitHubRepoUrl, verifyGitHubRepoAccess } from './upload.utils'

type UploadRepo = {
    userId: string
    repoURL: string
}

const uploadRepo = async (data: UploadRepo) => {
    const { userId, repoURL } = data

    const result = parseGitHubRepoUrl(repoURL)

    if (result.ok == false) {
        throw new Error(result.error)
    }

    const { owner, repo, normalizedUrl } = result

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    if (!user) {
        throw new Error('user not found')
    }

    if (user.githubToken == undefined) {
        throw new Error('access token not found')
    }

    const accestoken = user.githubToken as string

    const res = await verifyGitHubRepoAccess(owner, repo, accestoken)
}

const uploadZip = async () => {}

export const uploadService = {
    uploadRepo,
    uploadZip,
}
