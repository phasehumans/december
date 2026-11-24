import { gitlabOAuth } from '@december/shared/git'

import { env } from '../../env'

import type { OAuthApp } from '@december/shared/git'

// the nonce of a gitlab connect that this browser started; the callback must bring it back
export const GITLAB_STATE_COOKIE = 'gitlab_oauth_state'
export const GITLAB_COOKIE_PATH = '/api/v1/integrations/gitlab'
export const GITLAB_STATE_MAX_AGE_MS = 10 * 60 * 1000

// null until GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET are set (#645)
export const getGitlabOAuthApp = (): OAuthApp | null => {
    if (!env.GITLAB_CLIENT_ID || !env.GITLAB_CLIENT_SECRET) return null
    return {
        clientId: env.GITLAB_CLIENT_ID,
        clientSecret: env.GITLAB_CLIENT_SECRET,
        redirectUri: env.GITLAB_REDIRECT_URI || gitlabOAuth.getCallbackUrl(env.SERVER_URL),
    }
}

// a web app path with one query value added (`/a?b=1` + gitlab=error -> `/a?b=1&gitlab=error`)
export const withQuery = (path: string, key: string, value: string): string => {
    const [base, query = ''] = path.split('?')
    const params = new URLSearchParams(query)
    params.set(key, value)
    return `${base}?${params.toString()}`
}
