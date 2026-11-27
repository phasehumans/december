import { Prisma, prisma } from '@december/database'

// G1: every analytics read runs read-only with a 5-second limit, so a slow query is
// stopped by Postgres instead of holding the database. G3: values go in as parameters;
// the only raw text is the fixed column names below, never anything a user typed.
//
// At most 2 of these run at once in this process, so a page of charts can never take more
// than 2 database connections from the pool users need.
const MAX_ANALYTICS_CONNECTIONS = 2
let activeReads = 0
const waitingReads: Array<() => void> = []

const takeSlot = async () => {
    if (activeReads < MAX_ANALYTICS_CONNECTIONS) {
        activeReads++
        return
    }
    await new Promise<void>((resolve) => waitingReads.push(resolve))
}

const releaseSlot = () => {
    const next = waitingReads.shift()
    if (next) next()
    else activeReads--
}

const readOnly = async <T>(run: (tx: Prisma.TransactionClient) => Promise<T>) => {
    await takeSlot()
    try {
        return await prisma.$transaction(
            async (tx) => {
                await tx.$executeRaw`SET TRANSACTION READ ONLY`
                await tx.$executeRaw`SET LOCAL statement_timeout = 5000`
                return run(tx)
            },
            { maxWait: 5000, timeout: 20000 }
        )
    } finally {
        releaseSlot()
    }
}

/** A fixed timestamp column as an India-time timestamp. Only call it with literal names. */
const ist = (column: string) => Prisma.raw(`timezone('Asia/Kolkata', ${column} AT TIME ZONE 'UTC')`)

const istDay = (column: string) => Prisma.sql`to_char(${ist(column)}, 'YYYY-MM-DD')`
const istWeek = (column: string) =>
    Prisma.sql`to_char(date_trunc('week', ${ist(column)}), 'YYYY-MM-DD')`

// ----- overview -----

const overviewCounts = async (data: { todayStart: Date; dayAgo: Date; monthAgo: Date }) => {
    const { todayStart, dayAgo, monthAgo } = data
    return readOnly(async (tx) => {
        const [row] = await tx.$queryRaw<
            Array<{
                signupsToday: number
                activeDay: number
                agentsWorking: number
                sandboxesRunning: number
                creditsSpentToday: number
                paidMonth: number
                pendingRequests: number
                feedbackWeek: number
            }>
        >`
            SELECT
                (SELECT COUNT(*)::int FROM "User" WHERE "createdAt" >= ${todayStart}) AS "signupsToday",
                (SELECT COUNT(DISTINCT "userId")::int FROM "UsageEvent" WHERE "createdAt" >= ${dayAgo}) AS "activeDay",
                (SELECT COUNT(*)::int FROM "Session"
                    WHERE "vmStatus" IN ('RUNNING', 'PROVISIONING')) AS "agentsWorking",
                (SELECT COUNT(*)::int FROM "Session"
                    WHERE "sandboxStatus" IN ('STARTING', 'RUNNING')) AS "sandboxesRunning",
                (SELECT COALESCE(SUM("costInCents"), 0)::float8 FROM "UsageEvent"
                    WHERE "createdAt" >= ${todayStart} AND "billingSource" = 'CREDITS') AS "creditsSpentToday",
                (SELECT COALESCE(SUM("amountInCents"), 0)::float8 FROM "WalletTransaction"
                    WHERE "createdAt" >= ${monthAgo} AND status = 'SUCCESS'
                    AND provider IN ('RAZORPAY', 'COINBASE')) AS "paidMonth",
                (SELECT COUNT(*)::int FROM "CreditRequest" r
                    JOIN "User" u ON u.id = r."userId"
                    WHERE r.status = 'PENDING' AND u."isDeleted" = false) AS "pendingRequests",
                (SELECT COUNT(*)::int FROM "Feedback"
                    WHERE "createdAt" >= ${new Date(todayStart.getTime() - 6 * 86400000)}) AS "feedbackWeek"
        `
        // an aggregate always returns one row
        if (!row) throw new Error('overview counts returned no row')
        return row
    })
}

// ----- growth -----

const signupsByDay = async (since: Date) =>
    readOnly(
        (tx) =>
            tx.$queryRaw<Array<{ day: string; github: number; google: number; email: number }>>`
            SELECT ${istDay('"createdAt"')} AS day,
                COUNT(*) FILTER (WHERE "githubId" IS NOT NULL)::int AS github,
                COUNT(*) FILTER (WHERE "githubId" IS NULL AND "googleId" IS NOT NULL)::int AS google,
                COUNT(*) FILTER (WHERE "githubId" IS NULL AND "googleId" IS NULL)::int AS email
            FROM "User"
            WHERE "createdAt" >= ${since}
            GROUP BY 1
            ORDER BY 1
        `
    )

/**
 * O2: the Overview chart. Signups, users who made a model call, sessions started, credits
 * used and money paid, per India day, or per India week for the 1 year window.
 */
const trend = async (data: { since: Date; bucket: 'day' | 'week' }) => {
    const { since, bucket } = data
    const at = (column: string) => (bucket === 'week' ? istWeek(column) : istDay(column))
    return readOnly(async (tx) => {
        const [signups, active, sessions, credits, paid] = await Promise.all([
            tx.$queryRaw<Array<{ day: string; value: number }>>`
                SELECT ${at('"createdAt"')} AS day, COUNT(*)::int AS value
                FROM "User"
                WHERE "createdAt" >= ${since}
                GROUP BY 1
            `,
            tx.$queryRaw<Array<{ day: string; value: number }>>`
                SELECT ${at('"createdAt"')} AS day, COUNT(DISTINCT "userId")::int AS value
                FROM "UsageEvent"
                WHERE "createdAt" >= ${since}
                GROUP BY 1
            `,
            tx.$queryRaw<Array<{ day: string; value: number }>>`
                SELECT ${at('"createdAt"')} AS day, COUNT(*)::int AS value
                FROM "Session"
                WHERE "createdAt" >= ${since}
                GROUP BY 1
            `,
            tx.$queryRaw<Array<{ day: string; value: number }>>`
                SELECT ${at('"createdAt"')} AS day, COALESCE(SUM("costInCents"), 0)::float AS value
                FROM "UsageEvent"
                WHERE "createdAt" >= ${since} AND "billingSource" = 'CREDITS'
                GROUP BY 1
            `,
            tx.$queryRaw<Array<{ day: string; value: number }>>`
                SELECT ${at('"createdAt"')} AS day, COALESCE(SUM("amountInCents"), 0)::float AS value
                FROM "WalletTransaction"
                WHERE "createdAt" >= ${since} AND "status" = 'SUCCESS'
                    AND "provider" IN ('RAZORPAY', 'COINBASE')
                GROUP BY 1
            `,
        ])
        return { signups, active, sessions, credits, paid }
    })
}

const growthSummary = async (data: { dayAgo: Date; weekAgo: Date; monthAgo: Date }) => {
    const { dayAgo, weekAgo, monthAgo } = data
    return readOnly(async (tx) => {
        const [active] = await tx.$queryRaw<Array<{ day: number; week: number; month: number }>>`
            SELECT
                COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${dayAgo})::int AS day,
                COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${weekAgo})::int AS week,
                COUNT(DISTINCT "userId")::int AS month
            FROM "UsageEvent"
            WHERE "createdAt" >= ${monthAgo}
        `
        return { active }
    })
}

/**
 * Signup weeks of the last 8 weeks, and how many of each were active n weeks later. since
 * is the Monday (India time) 7 weeks ago; the raw "createdAt" is compared so the index works.
 */
const weeklyCohorts = async (since: Date) =>
    readOnly(async (tx) => {
        const sizes = await tx.$queryRaw<Array<{ cohort: string; size: number }>>`
            SELECT ${istWeek('"createdAt"')} AS cohort, COUNT(*)::int AS size
            FROM "User"
            WHERE "createdAt" >= ${since}
            GROUP BY 1
            ORDER BY 1
        `
        const cells = await tx.$queryRaw<Array<{ cohort: string; week: number; users: number }>>`
            WITH cohort AS (
                SELECT id, date_trunc('week', ${ist('"createdAt"')}) AS wk
                FROM "User"
                WHERE "createdAt" >= ${since}
            ),
            act AS (
                SELECT DISTINCT "userId", date_trunc('week', ${ist('"createdAt"')}) AS wk
                FROM "UsageEvent"
                WHERE "createdAt" >= ${since}
            )
            SELECT to_char(c.wk, 'YYYY-MM-DD') AS cohort,
                (EXTRACT(EPOCH FROM (a.wk - c.wk)) / 604800)::int AS week,
                COUNT(DISTINCT c.id)::int AS users
            FROM cohort c
            JOIN act a ON a."userId" = c.id AND a.wk >= c.wk
            GROUP BY 1, 2
            ORDER BY 1, 2
        `
        return { sizes, cells }
    })

// ----- money -----

const moneyByWeek = async (since: Date) =>
    readOnly(async (tx) => {
        const wallet = await tx.$queryRaw<Array<{ week: string; provider: string; cents: number }>>`
            SELECT ${istWeek('"createdAt"')} AS week, provider::text AS provider,
                COALESCE(SUM("amountInCents"), 0)::float8 AS cents
            FROM "WalletTransaction"
            WHERE "createdAt" >= ${since} AND status = 'SUCCESS'
            GROUP BY 1, 2
            ORDER BY 1
        `
        const spent = await tx.$queryRaw<Array<{ week: string; cents: number }>>`
            SELECT ${istWeek('"createdAt"')} AS week, COALESCE(SUM("costInCents"), 0)::float8 AS cents
            FROM "UsageEvent"
            WHERE "createdAt" >= ${since} AND "billingSource" = 'CREDITS'
            GROUP BY 1
            ORDER BY 1
        `
        return { wallet, spent }
    })

// ----- quality -----

const prsByWeek = async (since: Date) =>
    readOnly(async (tx) => {
        const weeks = await tx.$queryRaw<Array<{ kind: string; week: string; count: number }>>`
            SELECT 'opened' AS kind, ${istWeek('"prOpenedAt"')} AS week, COUNT(*)::int AS count
            FROM "Session" WHERE "prOpenedAt" >= ${since} GROUP BY 2
            UNION ALL
            SELECT 'merged', ${istWeek('"prMergedAt"')}, COUNT(*)::int
            FROM "Session" WHERE "prMergedAt" >= ${since} GROUP BY 2
            UNION ALL
            SELECT 'closed', ${istWeek('"prClosedAt"')}, COUNT(*)::int
            FROM "Session" WHERE "prClosedAt" >= ${since} AND "prMergedAt" IS NULL GROUP BY 2
        `
        return { weeks }
    })

// ----- product (A2 to A7) -----

/**
 * The product side of Analytics (A2 to A7), for the window that starts at since. All
 * counts; no session titles, prompts or repository names.
 */
const productStats = async (since: Date) =>
    readOnly(async (tx) => {
        // A2: the users who signed up in the window, and how far each got
        const [funnel] = await tx.$queryRaw<
            Array<{
                signedUp: number
                onboarded: number
                connectedGit: number
                ranAgent: number
                prOpened: number
                prMerged: number
            }>
        >`
            SELECT
                COUNT(*)::int AS "signedUp",
                COUNT(*) FILTER (WHERE u."onboardingCompletedAt" IS NOT NULL)::int AS "onboarded",
                COUNT(*) FILTER (WHERE u."githubConnected" OR EXISTS (
                    SELECT 1 FROM "GitConnection" g WHERE g."userId" = u.id))::int AS "connectedGit",
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "UsageEvent" e WHERE e."userId" = u.id))::int AS "ranAgent",
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "Session" s WHERE s."userId" = u.id AND s."prOpenedAt" IS NOT NULL))::int AS "prOpened",
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "Session" s WHERE s."userId" = u.id AND s."prMergedAt" IS NOT NULL))::int AS "prMerged"
            FROM "User" u
            WHERE u."createdAt" >= ${since} AND u."isDeleted" = false
        `

        // A3: users by where they worked, per week: the web app, the CLI, the GitHub app
        const channels = await tx.$queryRaw<
            Array<{ week: string; channel: string; users: number }>
        >`
            SELECT week, channel, COUNT(DISTINCT uid)::int AS users FROM (
                SELECT ${istWeek('"createdAt"')} AS week, 'web' AS channel, "userId" AS uid
                FROM "Session" WHERE "createdAt" >= ${since} AND "githubRun" IS NULL
                UNION ALL
                SELECT ${istWeek('"createdAt"')}, 'github', "userId"
                FROM "Session" WHERE "createdAt" >= ${since} AND "githubRun" IS NOT NULL
                UNION ALL
                SELECT ${istWeek('"createdAt"')}, 'cli', "userId"
                FROM "UsageEvent" WHERE "createdAt" >= ${since} AND "externalRequestId" LIKE 'proxy-%'
            ) x
            GROUP BY 1, 2
            ORDER BY 1
        `

        // A4: what the sessions started in the window led to
        const [outcomes] = await tx.$queryRaw<
            Array<{
                sessions: number
                withPr: number
                merged: number
                closed: number
                failed: number
                medianMergeHours: number | null
                additions: number
                deletions: number
            }>
        >`
            SELECT
                COUNT(*)::int AS sessions,
                COUNT(*) FILTER (WHERE "prNumber" IS NOT NULL)::int AS "withPr",
                COUNT(*) FILTER (WHERE "prMergedAt" IS NOT NULL)::int AS merged,
                COUNT(*) FILTER (WHERE "prClosedAt" IS NOT NULL AND "prMergedAt" IS NULL)::int AS closed,
                -- a run that failed marks its session vmStatus FAILED
                COUNT(*) FILTER (WHERE "vmStatus" = 'FAILED')::int AS failed,
                (percentile_cont(0.5) WITHIN GROUP (
                    ORDER BY EXTRACT(EPOCH FROM ("prMergedAt" - "prOpenedAt")) / 3600
                ) FILTER (WHERE "prMergedAt" IS NOT NULL AND "prOpenedAt" IS NOT NULL))::float8
                    AS "medianMergeHours",
                COALESCE(SUM("prAdditions"), 0)::int AS additions,
                COALESCE(SUM("prDeletions"), 0)::int AS deletions
            FROM "Session"
            WHERE "createdAt" >= ${since}
        `

        // A5: of the users active in the window, how many use each feature
        const [features] = await tx.$queryRaw<
            Array<{
                active: number
                cli: number
                ownKey: number
                githubApp: number
                skills: number
                mcp: number
                planFirst: number
                fast: number
            }>
        >`
            WITH active AS (
                SELECT DISTINCT "userId" AS id FROM "UsageEvent" WHERE "createdAt" >= ${since}
            )
            SELECT
                COUNT(*)::int AS active,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "UsageEvent" e WHERE e."userId" = a.id AND e."createdAt" >= ${since}
                        AND e."externalRequestId" LIKE 'proxy-%'))::int AS cli,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "UsageEvent" e WHERE e."userId" = a.id AND e."createdAt" >= ${since}
                        AND e."billingSource" = 'OWN_KEY'))::int AS "ownKey",
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "Session" s WHERE s."userId" = a.id AND s."createdAt" >= ${since}
                        AND s."githubRun" IS NOT NULL))::int AS "githubApp",
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "UserSkill" k WHERE k."userId" = a.id))::int AS skills,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM "UserMcpServer" m WHERE m."userId" = a.id))::int AS mcp,
                COUNT(*) FILTER (WHERE u."defaultPlanFirst")::int AS "planFirst",
                COUNT(*) FILTER (WHERE u."defaultEffort" = 'fast')::int AS fast
            FROM active a
            JOIN "User" u ON u.id = a.id
        `

        // A6: the models people use, and the providers of their own keys
        const models = await tx.$queryRaw<
            Array<{ model: string; calls: number; cents: number; ownKeyCalls: number }>
        >`
            SELECT model,
                COUNT(*)::int AS calls,
                COALESCE(SUM("costInCents") FILTER (WHERE "billingSource" = 'CREDITS'), 0)::float8 AS cents,
                COUNT(*) FILTER (WHERE "billingSource" = 'OWN_KEY')::int AS "ownKeyCalls"
            FROM "UsageEvent"
            WHERE "createdAt" >= ${since}
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 8
        `
        const keyProviders = await tx.$queryRaw<Array<{ provider: string; users: number }>>`
            SELECT provider, COUNT(*)::int AS users
            FROM "ProviderCredential"
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 8
        `

        // A7: what people wrote in "where did you hear about us", and referrals
        const heardFrom = await tx.$queryRaw<Array<{ answer: string; count: number }>>`
            SELECT lower(trim("heardFrom")) AS answer, COUNT(*)::int AS count
            FROM "CreditRequest"
            WHERE "createdAt" >= ${since} AND trim("heardFrom") <> ''
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 8
        `
        const [referrals] = await tx.$queryRaw<Array<{ joined: number; credited: number }>>`
            SELECT COUNT(*)::int AS joined,
                COUNT(*) FILTER (WHERE status = 'CREDITED')::int AS credited
            FROM "Referral"
            WHERE "createdAt" >= ${since}
        `

        // a count over a table always returns one row
        return {
            funnel: funnel!,
            channels,
            outcomes: outcomes!,
            features: features!,
            models,
            keyProviders,
            heardFrom,
            referrals: referrals!,
        }
    })

// ----- system -----

const databaseStats = async () =>
    readOnly(async (tx) => {
        const [row] = await tx.$queryRaw<
            Array<{ connections: number; maxConnections: number; sizeBytes: number }>
        >`
            SELECT
                (SELECT COUNT(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
                current_setting('max_connections')::int AS "maxConnections",
                pg_database_size(current_database())::float8 AS "sizeBytes"
        `
        return row
    })

const pingDatabase = async () => prisma.$queryRaw`SELECT 1`

const sandboxCounts = async () =>
    prisma.session.groupBy({
        by: ['sandboxStatus'],
        where: { sandboxStatus: { not: null } },
        _count: { _all: true },
    })

export const adminstatsRepository = {
    overviewCounts,
    signupsByDay,
    trend,
    growthSummary,
    weeklyCohorts,
    moneyByWeek,
    prsByWeek,
    productStats,
    databaseStats,
    pingDatabase,
    sandboxCounts,
}
