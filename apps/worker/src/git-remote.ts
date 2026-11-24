import { getGitProvider } from '@december/shared/git'

import type { GitProviderName } from '@december/shared/git'

// The clone url with the token in it, for a repo on the provider's own host. Any other url
// comes back as it is, so a token never goes to a host it does not belong to.
export const withGitToken = (data: {
    repoUrl: string
    token?: string | null
    provider: GitProviderName
}): string => {
    const { repoUrl, token, provider } = data
    if (!token) return repoUrl
    const git = getGitProvider(provider)
    const ref = git.parseRepoUrl(repoUrl)
    return ref ? git.getCloneUrl({ token, repoPath: ref.path }) : repoUrl
}
