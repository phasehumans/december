export type ViewState =
    | 'chat'
    | 'all-projects'
    | 'sessions'
    | 'profile'
    | 'templates'
    | 'docs'
    | 'cli'
    | 'project'

export type ProfileTab =
    | 'Account'
    | 'Preferences'
    | 'Integrations'
    | 'Billing'
    | 'Usage'
    | 'API Keys'

const profileTabToSlug: Record<string, string> = {
    Account: 'account',
    Preferences: 'preferences',
    Integrations: 'integrations',
    Billing: 'billing',
    Usage: 'usage',
    'API Keys': 'api-keys',
}

const slugToProfileTab: Record<string, ProfileTab> = Object.fromEntries(
    Object.entries(profileTabToSlug).map(([tab, slug]) => [slug, tab as ProfileTab])
)

export const getProfileTabFromSlug = (slug: string | undefined): ProfileTab =>
    (slug && slugToProfileTab[slug]) || 'Account'

export const getSlugForProfileTab = (tab: string): string => profileTabToSlug[tab] || 'account'

export const toProjectSlug = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'untitled'

const simpleViewToPath: Record<string, string> = {
    chat: '/',
    'all-projects': '/projects',
    sessions: '/sessions',
    templates: '/templates',
    docs: '/docs',
    cli: '/cli',
}

const simplePathToView: Record<string, ViewState> = Object.fromEntries(
    Object.entries(simpleViewToPath).map(([view, path]) => [path, view as ViewState])
)

export const getPathForView = (
    view: ViewState,
    context?: { projectSlug?: string; profileTab?: string }
): string => {
    if (view === 'project' && context?.projectSlug) {
        return `/project/${context.projectSlug}`
    }
    if (view === 'profile') {
        const tabSlug = context?.profileTab ? getSlugForProfileTab(context.profileTab) : 'account'
        return `/profile/${tabSlug}`
    }
    return simpleViewToPath[view] ?? '/'
}

export const getViewForPath = (pathname: string): ViewState => {
    // exact simple matches
    const simple = simplePathToView[pathname]
    if (simple) return simple

    // /profile or /profile/* → profile
    if (pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile'

    // /project/* → project (output screen)
    if (pathname.startsWith('/project/')) return 'project'

    return 'chat'
}
