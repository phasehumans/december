import { prisma } from '../../config/db'
import { AppError } from '../../utils/appError'

type GithubRepo = {
    id: number
    name: string
    fullName: string
    private: boolean
    defaultBranch: string
    updatedAt: string
    htmlUrl: string
    cloneUrl: string
    language: string | null
    description: string | null
    owner: {
        login: string
        avatarUrl: string
    }
}

type ConnectVercel = {
    code: string
    userId: string
    teamId?: string
    configurationId?: string
}

type VercelTokenResponse = {
    access_token: string
    user_id: string
    team_id: string | null
}

const listGithubRepos = async (userId: string): Promise<GithubRepo[]> => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
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
        language: repo.language ?? null,
        description: repo.description ?? null,
        owner: {
            login: repo.owner?.login,
            avatarUrl: repo.owner?.avatar_url,
        },
    }))
}

const connectVercel = async (data: ConnectVercel) => {
    const { code, userId, teamId, configurationId } = data

    const existingUser = await prisma.user.findFirst({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
            client_id: process.env.VERCEL_CLIENT_ID!,
            client_secret: process.env.VERCEL_CLIENT_SECRET!,
            code,
            redirect_uri: process.env.VERCEL_REDIRECT_URI!,
        }).toString(),
    })

    const rawResponse = await tokenResponse.text()

    if (!tokenResponse.ok) {
        throw new AppError(rawResponse, 400)
    }

    const tokenData = JSON.parse(rawResponse) as VercelTokenResponse

    const accessToken = tokenData.access_token

    if (!accessToken) {
        throw new AppError('vercel access token missing', 400)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            vercelConnected: true,
            vercelAccessToken: accessToken,
            vercelTeamId: teamId,
            vercelConfigurationId: configurationId,
        },
    })

    return updatedUser
}

const connectSupabase = async () => {}

const connectNotion = async () => {}

const connectStripe = async () => {}

export const integrationsService = {
    listGithubRepos,
    connectVercel,
    connectSupabase,
    connectNotion,
    connectStripe,
}
