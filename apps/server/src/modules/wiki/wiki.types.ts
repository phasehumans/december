import type { GenerateWikiDto, CreatePageDto, UpdatePageDto, WikiChatDto } from './wiki.schema'
import type { WikiStatus } from '@december/database'

export type { GenerateWikiDto, CreatePageDto, UpdatePageDto, WikiChatDto }

export interface UserGitHubRepo {
    id: string
    name: string
    fullName: string
    owner: string
    isPrivate: boolean
    description: string | null
    status: WikiStatus
    wikiId?: string
}

export interface GitHubReposResponse {
    githubConnected: boolean
    repos: UserGitHubRepo[]
}
