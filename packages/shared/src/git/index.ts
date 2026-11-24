import { githubProvider } from './github'

import type { GitProvider, GitProviderName } from './types'

export * from './types'
export { githubProvider } from './github'

const providers: Partial<Record<GitProviderName, GitProvider>> = {
    GITHUB: githubProvider,
}

export const getGitProvider = (name: GitProviderName): GitProvider => {
    const provider = providers[name]
    if (!provider) throw new Error(`unknown git provider: ${name}`)
    return provider
}

// the provider whose host serves this repo url, or null for any other host
export const detectGitProvider = (url: string): GitProviderName | null => {
    for (const provider of Object.values(providers)) {
        if (provider?.parseRepoUrl(url)) return provider.name
    }
    return null
}
