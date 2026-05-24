import { prisma } from '../../config/db'
import { AppError } from '../../utils/appError'
import axios from 'axios'

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

interface ConnectSupaBase {
    userId: string
    code?: string
}

type SupabaseConnectedResponse =
    | {
          type: 'redirect'
          url: string
      }
    | {
          type: 'connected'
      }

interface ConnectNotionParams {
    userId: string
    code?: string
}

type NotionConnectedResponse =
    | {
          type: 'redirect'
          url: string
      }
    | {
          type: 'success'
          workspaceName: string
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

const connectSupabase = async ({
    userId,
    code,
}: ConnectSupaBase): Promise<SupabaseConnectedResponse> => {
    if (!code) {
        const params = new URLSearchParams({
            client_id: process.env.SUPABASE_CLIENT_ID!,
            redirect_uri: process.env.SUPABASE_REDIRECT_URI!,
            response_type: 'code',
        })

        return {
            type: 'redirect',

            url: `https://api.supabase.com/v1/oauth/authorize?${params.toString()}`,
        }
    }

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SUPABASE_REDIRECT_URI!,
        client_id: process.env.SUPABASE_CLIENT_ID!,
        client_secret: process.env.SUPABASE_CLIENT_SECRET!,
    })

    const response = await axios.post('https://api.supabase.com/v1/oauth/token', params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    })

    const tokenData = response.data

    console.log('TOKEN DATA:', tokenData)

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    await prisma.user.update({
        where: {
            id: userId,
        },

        data: {
            supabaseConnected: true,
            supabaseAccessToken: tokenData.access_token,
            supabaseRefreshToken: tokenData.refresh_token,
            supabaseTokenExpiresAt: expiresAt,
            supabaseTokenScope: tokenData.scope ?? null,
            supabaseConnectedAt: new Date(),
        },
    })

    return {
        type: 'connected',
    }
}

const connectNotion = async ({
    userId,
    code,
}: ConnectNotionParams): Promise<NotionConnectedResponse> => {
    if (!code) {
        const params = new URLSearchParams({
            client_id: process.env.NOTION_CLIENT_ID!,
            response_type: 'code',
            owner: 'user',
            redirect_uri: process.env.NOTION_REDIRECT_URI!,
        })

        return {
            type: 'redirect',
            url: `https://api.notion.com/v1/oauth/authorize?${params.toString()}`,
        }
    }

    const response = await axios.post(
        'https://api.notion.com/v1/oauth/token',
        {
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.NOTION_REDIRECT_URI!,
        },
        {
            headers: {
                'Content-Type': 'application/json',
            },

            auth: {
                username: process.env.NOTION_CLIENT_ID!,
                password: process.env.NOTION_CLIENT_SECRET!,
            },
        }
    )

    const data = response.data

    await prisma.user.update({
        where: {
            id: userId,
        },

        data: {
            notionAccessToken: data.access_token,
            notionWorkspaceId: data.workspace_id,
            notionWorkspaceName: data.workspace_name,
        },
    })

    return {
        type: 'success',
        workspaceName: data.workspace_name,
    }
}

export const integrationsService = {
    listGithubRepos,
    connectVercel,
    connectSupabase,
    connectNotion,
}
