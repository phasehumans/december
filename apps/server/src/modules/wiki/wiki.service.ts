import { prisma } from '@december/database'
import * as wikiRepo from './wiki.repository'
import { slugify } from './wiki.utils'
import type { CreatePageDto, UpdatePageDto, GitHubReposResponse } from './wiki.types'

export async function getUserGitHubRepos(userId: string): Promise<GitHubReposResponse> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubConnected: true, githubToken: true, githubUsername: true },
    })

    if (!user || !user.githubConnected) {
        return {
            githubConnected: false,
            repos: [],
        }
    }

    const existingWikis = await wikiRepo.findWikisByUser(userId)
    const wikiMap = new Map(existingWikis.map((w) => [w.repoFullName, w]))

    // Base mock repository list for connected accounts if no live GitHub token fetch
    const baseRepos = [
        {
            id: 'repo-1',
            name: 'december-core',
            fullName: `${user.githubUsername || 'user'}/december-core`,
            owner: user.githubUsername || 'user',
            isPrivate: false,
            description: 'Core engine and application platform',
        },
        {
            id: 'repo-2',
            name: 'docs-site',
            fullName: `${user.githubUsername || 'user'}/docs-site`,
            owner: user.githubUsername || 'user',
            isPrivate: true,
            description: 'Documentation website for projects',
        },
    ]

    const repos = baseRepos.map((repo) => {
        const wiki = wikiMap.get(repo.fullName)
        return {
            ...repo,
            status: wiki ? wiki.status : ('IDLE' as const),
            wikiId: wiki?.id,
        }
    })

    return {
        githubConnected: true,
        repos,
    }
}

export async function generateWiki(
    userId: string,
    repoOwner: string,
    repoName: string,
    _repoUrl?: string
) {
    const repoFullName = `${repoOwner}/${repoName}`
    let wiki = await wikiRepo.upsertRepositoryWiki(userId, repoOwner, repoName, 'GENERATING')

    const defaultPages = [
        {
            title: 'Overview',
            slug: 'overview',
            content: `# Overview\n\nWelcome to the AI-generated documentation for **${repoFullName}**.\n\nThis repository provides core services and components.`,
            order: 1,
        },
        {
            title: 'Architecture',
            slug: 'architecture',
            content: `# Architecture\n\nSystem design and architecture breakdown for **${repoFullName}**.\n\n- Frontend: React / Vite\n- Backend: Express / Bun / Prisma`,
            order: 2,
        },
        {
            title: 'Getting Started',
            slug: 'getting-started',
            content: `# Getting Started\n\nHow to install dependencies and run **${repoFullName}** locally.\n\n\`\`\`bash\nbun install\nbun dev\n\`\`\``,
            order: 3,
        },
    ]

    for (const page of defaultPages) {
        const existing = await wikiRepo.findPageBySlug(wiki.id, page.slug)
        if (!existing) {
            await wikiRepo.createWikiPage({
                wikiId: wiki.id,
                title: page.title,
                slug: page.slug,
                content: page.content,
                order: page.order,
            })
        }
    }

    wiki = (await wikiRepo.updateWikiStatus(wiki.id, 'COMPLETED')) as any
    return wikiRepo.findWikiById(userId, wiki.id)
}

export async function getWikiByRepo(userId: string, repoOwner: string, repoName: string) {
    const repoFullName = `${repoOwner}/${repoName}`
    const wiki = await wikiRepo.findWikiByRepo(userId, repoFullName)
    if (!wiki) {
        throw new Error('Wiki not found')
    }
    return wiki
}

export async function createWikiPage(userId: string, dto: CreatePageDto) {
    const wiki = await wikiRepo.findWikiById(userId, dto.wikiId)
    if (!wiki) {
        throw new Error('Unauthorized or wiki not found')
    }

    const slug = dto.slug || slugify(dto.title)
    const existing = await wikiRepo.findPageBySlug(dto.wikiId, slug)
    if (existing) {
        throw new Error('Page slug already exists in this wiki')
    }

    return wikiRepo.createWikiPage({
        wikiId: dto.wikiId,
        title: dto.title,
        slug,
        content: dto.content,
        order: dto.order ?? wiki.pages.length + 1,
    })
}

export async function updateWikiPage(userId: string, pageId: string, dto: UpdatePageDto) {
    const page = await wikiRepo.findPageById(pageId)
    if (!page || page.wiki.userId !== userId) {
        throw new Error('Unauthorized or page not found')
    }

    const updates: Partial<{ title: string; slug: string; content: string; order: number }> = {}
    if (dto.title !== undefined) updates.title = dto.title
    if (dto.content !== undefined) updates.content = dto.content
    if (dto.order !== undefined) updates.order = dto.order

    if (dto.slug || (dto.title && dto.title !== page.title)) {
        const newSlug = dto.slug || slugify(dto.title!)
        if (newSlug !== page.slug) {
            const existing = await wikiRepo.findPageBySlug(page.wikiId, newSlug)
            if (existing && existing.id !== pageId) {
                throw new Error('Page slug already exists in this wiki')
            }
            updates.slug = newSlug
        }
    }

    return wikiRepo.updateWikiPage(pageId, updates)
}

export async function deleteWikiPage(userId: string, pageId: string) {
    const page = await wikiRepo.findPageById(pageId)
    if (!page || page.wiki.userId !== userId) {
        throw new Error('Unauthorized or page not found')
    }

    return wikiRepo.deleteWikiPage(pageId)
}

export async function chatWithWiki(
    userId: string,
    prompt: string,
    repoFullName?: string,
    wikiId?: string
) {
    let wiki = null
    if (wikiId) {
        wiki = await wikiRepo.findWikiById(userId, wikiId)
    } else if (repoFullName) {
        wiki = await wikiRepo.findWikiByRepo(userId, repoFullName)
    }

    const wikiTitle = wiki ? wiki.repoFullName : 'the repository'
    const pagesSummary =
        wiki?.pages.map((p) => `- ${p.title}: ${p.content.slice(0, 100)}...`).join('\n') ||
        'No pages found.'

    return {
        answer: `Based on the repository documentation for **${wikiTitle}**:\n\n${pagesSummary}\n\nIn response to your query "${prompt}": The repository is set up with standard modules and documentation structure.`,
    }
}
