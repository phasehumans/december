import { prisma } from '../../config/db'
import { downloadGitHubRepoArchive } from './downloadzip'
import { parseGitHubRepoUrl, verifyGitHubRepoAccess } from './upload.utils'

type UploadRepo = {
    userId: string
    repoURL: string
}

const listGithubRepos = async () => {}

const importFromGithub = async (data: UploadRepo) => {
    const { userId, repoURL } = data

    const parseData = parseGitHubRepoUrl(repoURL)

    if (parseData.ok === false) {
        throw new Error(parseData.error)
    }

    const { owner, repo } = parseData

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

    const accesstoken = user.githubToken

    const repoAccessInfo = await verifyGitHubRepoAccess(owner, repo, accesstoken)

    if (repoAccessInfo.ok === false) {
        throw new Error(repoAccessInfo.error)
    }

    const { owner: verfiedOwner, repo: verifiedRepo, defaultBranch } = repoAccessInfo

    const ref = defaultBranch ?? 'main'

    const downloadZipDetails = await downloadGitHubRepoArchive(
        verfiedOwner,
        verifiedRepo,
        accesstoken,
        ref
    )

    return { downloadZipDetails }
}

const importFromZip = async () => {}

export const uploadService = {
    importFromGithub,
    importFromZip,
}
