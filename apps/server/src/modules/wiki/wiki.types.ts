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

export type GetUserGitHubRepos = {
    userId: string
}

export type GenerateWiki = {
    userId: string
    repoOwner: string
    repoName: string
    repoUrl?: string
}

export type GetWikiByRepo = {
    userId: string
    repoOwner: string
    repoName: string
}

export type CreateWikiPage = {
    userId: string
    dto: CreatePageDto
}

export type UpdateWikiPage = {
    userId: string
    pageId: string
    dto: UpdatePageDto
}

export type DeleteWikiPage = {
    userId: string
    pageId: string
}

export type ChatWithWiki = {
    userId: string
    prompt: string
    repoFullName?: string
    wikiId?: string
}
