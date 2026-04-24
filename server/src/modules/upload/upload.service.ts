import { prisma } from '../../config/db'
import { downloadGitHubRepoArchive } from './downloadzip'
import { parseGitHubRepoUrl, verifyGitHubRepoAccess } from './upload.utils'

type UploadRepo = {
    userId: string
    repoURL: string
}

type GithubRepo = {
    id: number
    name: string
    fullName: string
    private: boolean
    defaultBranch: string
    updatedAt: string
    htmlUrl: string
    cloneUrl: string
    owner: {
        login: string
        avatarUrl: string
    }
}

const listGithubRepos = async (data: string): Promise<GithubRepo[]> => {
    const user = await prisma.user.findUnique({
        where: {
            id: data,
        },
        select: {
            githubToken: true,
            githubUsername: true,
            githubConnected: true,
        },
    })

    if (!user) {
        throw new Error('user not found')
    }

    if (user.githubConnected === false) {
        throw new Error('github is not connected')
    }

    if (user.githubToken === undefined) {
        throw new Error('github access token not found')
    }

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${user.githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch GitHub repos: ${errorText}`)
    }

    const repos = (await response.json()) as any[]

    return repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        owner: {
            login: repo.owner?.login,
            avatarUrl: repo.owner?.avatar_url,
        },
    }))
}

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
    listGithubRepos,
    importFromGithub,
    importFromZip,
}
