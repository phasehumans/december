import { apiRequest } from '@/shared/api/client'

// the admin panel (#624). every route is checked on the server: the admin's web sign-in,
// ADMIN_EMAILS and an authenticator code entered in the last 12 hours

export type CreditRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** users on one page of the Users tab */
export const USERS_PAGE_SIZE = 25

// the Users tab: newest signups first, a page at a time
export interface AdminUserRow {
    id: string
    name: string
    email: string
    createdAt: string
    lastActiveAt: string | null
    // cents
    creditBalance: number
    // a throwaway inbox (mailinator and the like)
    disposable: boolean
    // M1: the waiting free credit request, with what helps decide on it
    pendingRequest: {
        id: string
        buildPlan: string
        heardFrom: string
        createdAt: string
        signals: {
            accountAgeDays: number
            signupMethod: 'github' | 'google' | 'email'
            githubUsername: string | null
            otherAccountsSameInbox: number
            otherRequestsSameIp: number
        }
    } | null
    // M4: the newest feedback the user sent
    latestFeedback: { feedback: string; rating: string | null; createdAt: string } | null
}

export type AdminUserFilter = 'all' | 'active' | 'asked' | 'feedback'

export type WalletProvider = 'RAZORPAY' | 'COINBASE' | 'GRANT' | 'ADJUSTMENT' | 'REFERRAL'

// the user card (U1, D1-D11). Repositories and pull requests are counts only
export interface AdminUserDetails {
    id: string
    name: string
    email: string
    disposable: boolean
    createdAt: string
    lastActiveAt: string | null
    account: {
        signupMethod: 'github' | 'google' | 'email'
        googleLinked: boolean
        emailVerified: boolean
        onboarding: string
        onboardingDoneAt: string | null
        timezone: string
        notifyLevel: 'ALL' | 'IMPORTANT' | 'NONE'
        notifyPush: boolean
        productEmails: boolean
        securityAlerts: boolean
        lastExport: { status: string; createdAt: string } | null
    }
    defaults: {
        modelSource: 'CREDITS' | 'OWN_KEY'
        ownKeyModel: string | null
        planFirst: boolean
        effort: string
        openPullRequest: boolean
        repository: string
        baseBranch: string
        idleStopMinutes: number
        archiveAfterDays: number | null
        lowBalanceAlertCents: number | null
        sessionLimitCents: number | null
        dayLimitCents: number | null
        blockedTools: number
    }
    connected: {
        github: { username: string | null; appInstalled: boolean; installations: number } | null
        gitlab: { username: string } | null
        ownKeys: Array<{
            provider: string
            model: string
            verifiedAt: string
            lastUsedAt: string | null
        }>
        skills: number
        mcpServers: number
        secrets: number
        projects: number
        pushBrowsers: number
    }
    devices: Array<{
        label: string
        kind: 'web' | 'cli'
        signedInAt: string
        lastActiveAt: string
    }>
    usage: {
        spentCents: number
        spent30Cents: number
        spentDayCents: number
        calls: number
        tokens: number
        cliCalls: number
        ownKeyCalls: number
        firstAt: string | null
        lastAt: string | null
        topModels: Array<{ model: string; calls: number; cents: number }>
        daily: Array<{ day: string; cents: number }>
    }
    sessions: {
        total: number
        archived: number
        running: number
        waiting: number
        githubRuns: number
        repos: number
    }
    prs: { opened: number; merged: number; closed: number; additions: number; deletions: number }
    money: {
        balanceCents: number
        paidCents: number
        freeCents: number
        failedPayments: number
        wallet: Array<{
            id: string
            provider: WalletProvider
            amountInCents: number
            status: 'PENDING' | 'SUCCESS' | 'FAILED'
            createdAt: string
        }>
    }
    referral: {
        code: string | null
        invitedBy: string | null
        invited: Array<{ email: string; status: string; createdAt: string }>
    }
    creditRequest: {
        id: string
        status: 'PENDING' | 'APPROVED' | 'REJECTED'
        buildPlan: string
        heardFrom: string
        agreedToFeedback: boolean
        rejectReason: string | null
        reviewedAt: string | null
        createdAt: string
    } | null
    feedback: {
        total: number
        items: Array<{ id: string; rating: string | null; feedback: string; createdAt: string }>
    }
    adminHistory: Array<{
        id: string
        action: string
        amountInCents: number | null
        createdAt: string
    }>
}

export interface AdminUserPage {
    items: AdminUserRow[]
    total: number
    page: number
    pages: number
    pageSize: number
}

export interface AdminSandbox {
    sessionId: string
    sandboxId: string
    sandboxStatus: 'STARTING' | 'RUNNING' | 'PAUSED'
    agentWorking: boolean
    lastActivityAt: string | null
    createdAt: string
    userId: string
    email: string
    userRunningCount: number
}

export interface AdminTotpStatus {
    enabled: boolean
    lockedUntil: string | null
    verifiedAt: string | null
    verifiedUntil: string | null
}

export interface AdminMe {
    id: string
    email: string
    name: string | null
    adminPath: string
    totp: AdminTotpStatus
}

export interface AdminCreditLedger {
    // credits you gave in 24 hours (approved requests and by hand), and the per-user cap
    cap: { usedCents: number; capCents: number; userCapCents: number }
    items: Array<{
        id: string
        amountInCents: number
        kind: string
        reason: string | null
        createdAt: string
        userId: string
        email: string
    }>
}

export type CheckStatus = 'ok' | 'warn' | 'down'

export interface AdminOverview {
    signupsToday: number
    // signups in the last 7 India days, today included
    signups7d: number
    activeDay: number
    agentsWorking: number
    sandboxesRunning: number
    creditsSpentTodayCents: number
    paid30dCents: number
    needsYou: {
        pendingRequests: number
        feedbackWeek: number
        failedJobsDay: number
    }
}

// O2: the Analytics chart: the history behind the Overview numbers, per India day (or week for a year)
export type TrendMetric = 'signups' | 'active' | 'sessions' | 'creditsCents' | 'paidCents'
export interface AdminTrend {
    days: number
    // 7, 30 and 90 days are by day; a year (365) is by week, each keyed by its Monday
    bucket: 'day' | 'week'
    points: Array<{ day: string } & Record<TrendMetric, number>>
}

// the Analytics tab: the five things that matter now
export interface AdminAnalytics {
    days: number
    // A2: of the users who signed up in the window, how far each got
    funnel: {
        signedUp: number
        onboarded: number
        connectedGit: number
        ranAgent: number
        prOpened: number
        prMerged: number
    }
    // A3: users by where they worked, per week
    channels: Array<{ week: string; channel: 'web' | 'cli' | 'github'; users: number }>
    // A4: what the sessions started in the window led to
    outcomes: {
        sessions: number
        withPr: number
        merged: number
        closed: number
        failed: number
        medianMergeHours: number | null
        additions: number
        deletions: number
    }
    // A5: of the users active in the window
    features: {
        active: number
        cli: number
        ownKey: number
        githubApp: number
        skills: number
        mcp: number
        planFirst: number
        fast: number
    }
    // A6
    models: Array<{ model: string; calls: number; cents: number; ownKeyCalls: number }>
    keyProviders: Array<{ provider: string; users: number }>
    // A7
    signupMethods: { github: number; google: number; email: number }
    heardFrom: Array<{ answer: string; count: number }>
    referrals: { joined: number; credited: number }
    // A8
    active: { day: number; week: number; month: number }
    cohorts: {
        sizes: Array<{ cohort: string; size: number }>
        cells: Array<{ cohort: string; week: number; users: number }>
    }
    wallet: Array<{ week: string; provider: string; cents: number }>
    spent: Array<{ week: string; cents: number }>
    prWeeks: Array<{ kind: 'opened' | 'merged' | 'closed'; week: string; count: number }>
}

// C1, C2: visitors of the landing page and the web app, from Cloudflare Web Analytics
type NotConnected = { connected: false }
type CloudflareError = { connected: true; error: string }
export type AdminVisitors =
    | NotConnected
    | CloudflareError
    | {
          connected: true
          error: null
          requestedDays: number
          // Cloudflare answers at most 90 days here
          days: number
          landing: { host: string; visits: number; pageViews: number }
          app: { host: string; visits: number; pageViews: number }
          signups: number
          topPages: Array<{ path: string; views: number }>
          referrers: Array<{ host: string; visits: number }>
      }

// C4: traffic at Cloudflare's edge
export type AdminEdge =
    | NotConnected
    | CloudflareError
    | {
          connected: true
          error: null
          // the last 24 hours
          requests: number
          serverErrors: number
          blocked: number
          cacheHitPct: number | null
      }

// C5: page speed for real users, p75 over the last 30 days
export type AdminPageSpeed =
    | NotConnected
    | CloudflareError
    | {
          connected: true
          error: null
          days: number
          sites: Array<{
              host: string
              label: string
              samples: number
              lcpMs: number | null
              inpMs: number | null
              cls: number | null
              lcpGoodPct?: number | null
              inpGoodPct?: number | null
              clsGoodPct?: number | null
          }>
      }

// C3: the last Cloudflare Pages deploys of each project
export interface AdminDeploys {
    connected: boolean
    projects: Array<{
        name: string
        error: string | null
        deploys: Array<{
            id: string
            shortId: string
            environment: string
            // success, failure, active, idle, canceled or skipped
            status: string
            stage: string | null
            createdAt: string | null
            endedAt: string | null
            branch: string | null
            commit: string | null
            message: string | null
            url: string | null
        }>
    }>
}

// S1: the public status page (Better Stack), as the server reads it
export type PublicState = 'operational' | 'degraded' | 'downtime' | 'maintenance'
export interface AdminPublicStatus {
    available: boolean
    overall: PublicState | null
    announcement: string | null
    services: Array<{ name: string; state: PublicState | null }>
    days: Array<{
        day: string
        status:
            | 'downtime'
            | 'degraded'
            | 'recovered'
            | 'maintenance'
            | 'operational'
            | 'not_monitored'
        problems: string[]
    }>
}

interface HealthPart {
    status: CheckStatus
    detail: string
}

export interface AdminHealth {
    status: CheckStatus
    checkedAt: string
    server: HealthPart & {
        uptimeSeconds: number
        memoryMb: number
        heapMb: number
        eventLoopP99Ms: number
        commit: string | null
        runtime: string
        host: string
        lastStartAt: string | null
        startsLastDay: number | null
        // S3: the last few starts, newest first
        recentStarts: string[]
    }
    // the EC2 machine: CPU load, memory and disk
    machine: HealthPart & {
        load?: number[]
        cores?: number
        memoryUsedPct?: number
        memoryText?: string
        diskUsedPct?: number
        diskText?: string
    }
    database: HealthPart & {
        pingMs: number | null
        connections?: number | null
        maxConnections?: number | null
        sizeText?: string | null
    }
    redis: HealthPart & { pingMs: number | null; memory?: string | null }
    worker: HealthPart & {
        workers: Array<{
            host: string
            at: string
            secondsAgo: number
            memoryMb: number | null
            jobsDoneLastHour: number | null
            jobsFailedLastHour: number | null
        }>
    }
    queues: HealthPart & {
        items: Array<{
            name: string
            label: string
            status: CheckStatus
            waiting: number
            active: number
            delayed: number
            failed: number
            error?: string
        }>
    }
    errors: HealthPart & { hourly: Array<{ hour: string; count: number }> }
    sandboxes: { starting: number; running: number; paused: number }
}

export interface AdminFailedJobs {
    lastDay: number
    items: Array<{
        queue: string
        id?: string
        name: string
        reason: string
        attempts: number
        failedAt: string | null
    }>
}

type Items<T> = { items: T[] }

const post = <T>(path: string, body: object = {}) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const adminAPI = {
    getMe: () => apiRequest<AdminMe>('/admin/me'),
    // A5: "name, email, turn-off link" per person with product emails on, for announce.py
    getProductEmailList: () =>
        apiRequest<{ count: number; text: string }>('/admin/product-email-list'),
    startTotpSetup: () => post<{ qrDataUrl: string; key: string }>('/admin/totp/setup'),
    enableTotp: (code: string) => post<AdminTotpStatus>('/admin/totp/enable', { code }),
    verifyTotp: (code: string) => post<AdminTotpStatus>('/admin/totp/verify', { code }),

    // fresh skips the server's short cache (the Refresh button)
    getOverview: (fresh = false) =>
        apiRequest<AdminOverview>(`/admin/overview${fresh ? '?fresh=1' : ''}`),
    getTrend: (days: number, fresh = false) =>
        apiRequest<AdminTrend>(`/admin/analytics/trend?days=${days}${fresh ? '&fresh=1' : ''}`),
    getAnalytics: (days: number) => apiRequest<AdminAnalytics>(`/admin/analytics?days=${days}`),
    getHealth: (fresh = false) =>
        apiRequest<AdminHealth>(`/admin/system/health${fresh ? '?fresh=1' : ''}`),
    getVisitors: (days: number, fresh = false) =>
        apiRequest<AdminVisitors>(
            `/admin/analytics/visitors?days=${days}${fresh ? '&fresh=1' : ''}`
        ),
    getEdge: (fresh = false) =>
        apiRequest<AdminEdge>(`/admin/system/edge${fresh ? '?fresh=1' : ''}`),
    getPageSpeed: (fresh = false) =>
        apiRequest<AdminPageSpeed>(`/admin/system/page-speed${fresh ? '?fresh=1' : ''}`),
    getDeploys: (fresh = false) =>
        apiRequest<AdminDeploys>(`/admin/system/deploys${fresh ? '?fresh=1' : ''}`),
    getPublicStatus: (fresh = false) =>
        apiRequest<AdminPublicStatus>(`/admin/system/public-status${fresh ? '?fresh=1' : ''}`),
    getFailedJobs: (fresh = false) =>
        apiRequest<AdminFailedJobs>(`/admin/system/failed-jobs${fresh ? '?fresh=1' : ''}`),

    approveCreditRequest: (id: string) => post(`/admin/credit-requests/${id}/approve`),
    rejectCreditRequest: (id: string, reason: string) =>
        post(`/admin/credit-requests/${id}/reject`, { reason }),
    getCreditLedger: () => apiRequest<AdminCreditLedger>('/admin/credit-ledger'),

    listUsers: (q: string, page = 1, filter: AdminUserFilter = 'all') =>
        apiRequest<AdminUserPage>(
            `/admin/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=${USERS_PAGE_SIZE}&filter=${filter}`
        ),
    getUser: (id: string) => apiRequest<AdminUserDetails>(`/admin/users/${encodeURIComponent(id)}`),
    // add only, within the daily limits ($10 a user, $50 in total)
    adjustCredits: (id: string, amountInCents: number) =>
        post(`/admin/users/${id}/credits`, { amountInCents }),

    listSandboxes: () => apiRequest<Items<AdminSandbox>>('/admin/sandboxes'),
    controlSandbox: (sessionId: string, action: 'pause' | 'stop') =>
        post(`/admin/sandboxes/${sessionId}/${action}`),
}
