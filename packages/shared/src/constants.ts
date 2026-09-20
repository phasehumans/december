export const DEFAULT_DEV_WEB_URL = 'http://localhost:3000'
export const DEFAULT_PROD_WEB_URL = 'https://app.trydecember.com'

export const DEFAULT_DEV_DOCS_URL = 'http://localhost:2000'
export const DEFAULT_PROD_DOCS_URL = 'https://trydecember.com'

export const DEFAULT_DEV_SERVER_URL = 'http://localhost:4000'
export const DEFAULT_PROD_SERVER_URL = 'https://api.trydecember.com'

export type EnvironmentMode = 'development' | 'test' | 'production'

export const getWebUrl = (env?: string): string =>
    process.env.WEB_URL ||
    (env === 'production' || process.env.NODE_ENV === 'production'
        ? DEFAULT_PROD_WEB_URL
        : DEFAULT_DEV_WEB_URL)

export const getDocsUrl = (env?: string): string =>
    process.env.DECEMBER_DOCS_URL ||
    process.env.DOCS_URL ||
    process.env.LANDING_URL ||
    (env === 'production' || process.env.NODE_ENV === 'production'
        ? DEFAULT_PROD_DOCS_URL
        : DEFAULT_DEV_DOCS_URL)

export const getServerUrl = (env?: string): string =>
    process.env.SERVER_URL ||
    (env === 'production' || process.env.NODE_ENV === 'production'
        ? DEFAULT_PROD_SERVER_URL
        : DEFAULT_DEV_SERVER_URL)

export const getApiV1Url = (env?: string): string => `${getServerUrl(env)}/api/v1`
