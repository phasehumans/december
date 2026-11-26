import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'

import { adminAPI } from '../src/features/admin/api/admin'
import { AdminSystem } from '../src/features/admin/components/AdminSystem'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, waitFor, fireEvent } = await import('@testing-library/react')

const renderTab = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <AdminSystem />
        </QueryClientProvider>
    )

afterEach(() => {
    cleanup()
})

const health = (over: { diskUsedPct?: number; machineStatus?: 'ok' | 'warn' } = {}) => ({
    status: over.machineStatus ?? 'ok',
    checkedAt: new Date().toISOString(),
    server: {
        status: 'ok',
        detail: 'up 5 min',
        uptimeSeconds: 300,
        memoryMb: 120,
        heapMb: 60,
        eventLoopP99Ms: 4,
        commit: 'abcdef1234',
        runtime: 'bun 1.3.14',
        host: 'box',
        lastStartAt: null,
        startsLastDay: 1,
        recentStarts: [new Date(Date.now() - 5 * 60 * 1000).toISOString()],
    },
    machine: {
        status: over.machineStatus ?? 'ok',
        detail: `disk ${over.diskUsedPct ?? 40}% used, memory 50% used`,
        load: [0.2, 0.3, 0.3],
        cores: 2,
        memoryUsedPct: 50,
        memoryText: '1 GB of 2 GB',
        diskUsedPct: over.diskUsedPct ?? 40,
        diskText: '8 GB of 20 GB, 12 GB free',
    },
    database: {
        status: 'ok',
        detail: '3 ms',
        pingMs: 3,
        connections: 5,
        maxConnections: 100,
        sizeText: '42 MB',
    },
    redis: { status: 'ok', detail: '1 ms', pingMs: 1, memory: '3 MB of 256 MB' },
    worker: {
        status: 'ok',
        detail: 'last seen 10 s ago',
        workers: [
            {
                host: 'w',
                at: new Date().toISOString(),
                secondsAgo: 10,
                memoryMb: 200,
                jobsDoneLastHour: 12,
                jobsFailedLastHour: 1,
            },
        ],
    },
    queues: {
        status: 'ok',
        detail: '',
        items: [
            {
                name: 'agent_jobs',
                label: 'Agent runs',
                status: 'ok',
                waiting: 0,
                active: 1,
                delayed: 0,
                failed: 0,
            },
        ],
    },
    errors: {
        status: 'ok',
        detail: '0 in the last hour',
        hourly: [{ hour: new Date().toISOString(), count: 0 }],
    },
    sandboxes: { starting: 0, running: 1, paused: 2 },
})

const publicStatus = {
    available: true,
    overall: 'operational',
    announcement: 'Deploy at 10 pm IST',
    services: [
        { name: 'API', state: 'operational' },
        { name: 'Web app', state: 'degraded' },
    ],
    days: [
        { day: '2026-11-24', status: 'operational', problems: [] },
        { day: '2026-11-25', status: 'downtime', problems: ['API down'] },
        { day: '2026-11-26', status: 'operational', problems: [] },
    ],
}

const connectedDeploys = {
    connected: true,
    projects: [
        {
            name: 'december-web',
            error: null,
            deploys: [
                {
                    id: 'd1',
                    shortId: 'd1',
                    environment: 'production',
                    status: 'failure',
                    stage: 'build',
                    createdAt: new Date().toISOString(),
                    endedAt: null,
                    branch: 'main',
                    commit: 'abc1234',
                    message: 'feat: new admin',
                    url: null,
                },
            ],
        },
        { name: 'december-docs', error: 'Authentication error', deploys: [] },
    ],
}

const edgeData = {
    connected: true,
    error: null,
    requests: 4530,
    serverErrors: 5,
    blocked: 63,
    cacheHitPct: 24,
}

const speedData = {
    connected: true,
    error: null,
    days: 30,
    sites: [
        {
            host: 'trydecember.com',
            label: 'Landing page',
            samples: 410,
            lcpMs: 1148,
            inpMs: 80,
            cls: 0,
            lcpGoodPct: 97,
            inpGoodPct: 88,
            clsGoodPct: 100,
        },
        {
            host: 'app.trydecember.com',
            label: 'Web app',
            samples: 530,
            lcpMs: 4600,
            inpMs: 120,
            cls: 0,
            lcpGoodPct: 60,
            inpGoodPct: 100,
            clsGoodPct: 100,
        },
    ],
}

const mockApi = (
    data: ReturnType<typeof health>,
    failed: any[] = [],
    status: any = publicStatus,
    deploys: any = { connected: false, projects: [] },
    edge: any = { connected: false },
    speed: any = { connected: false }
) => {
    adminAPI.getHealth = (async () => data) as any
    adminAPI.getPublicStatus = (async () => status) as any
    adminAPI.getDeploys = (async () => deploys) as any
    adminAPI.getEdge = (async () => edge) as any
    adminAPI.getPageSpeed = (async () => speed) as any
    adminAPI.getFailedJobs = (async () => ({ lastDay: failed.length, items: failed })) as any
    adminAPI.listSandboxes = (async () => ({
        items: [
            {
                sessionId: 's1',
                title: 'busy',
                sandboxId: 'vm1',
                sandboxStatus: 'RUNNING',
                agentWorking: true,
                lastActivityAt: null,
                createdAt: new Date().toISOString(),
                userId: 'u1',
                email: 'runner@example.com',
                userRunningCount: 1,
            },
            {
                sessionId: 's2',
                title: 'idle',
                sandboxId: 'vm2',
                sandboxStatus: 'PAUSED',
                agentWorking: false,
                lastActivityAt: null,
                createdAt: new Date().toISOString(),
                userId: 'u2',
                email: 'paused@example.com',
                userRunningCount: 0,
            },
        ],
    })) as any
}

describe('admin system tab', () => {
    test('S1: the public status like /status, with the 90-day bar and the detailed link', async () => {
        mockApi(health())
        const view = renderTab()
        await waitFor(() => expect(view.getByText('All systems normal')).toBeTruthy())
        expect(view.getByText('Deploy at 10 pm IST')).toBeTruthy()
        expect(view.getByText('API')).toBeTruthy()
        expect(view.getByText('Slow')).toBeTruthy()
        const bars = view.getByRole('img', { name: 'The last 90 days, one bar a day' })
        expect(bars.children).toHaveLength(90)
        // the newest day is the last bar, and each bar says what happened
        expect((bars.children[88] as HTMLElement).title).toContain('API down')
        expect(
            view.getByRole('link', { name: /Check detailed system status/ }).getAttribute('href')
        ).toBe('https://status.trydecember.com/')
    })

    test('S1: when the public status cannot be read, it says so and still links out', async () => {
        mockApi(health(), [], {
            available: false,
            overall: null,
            announcement: null,
            services: [],
            days: [],
        })
        const view = renderTab()
        await waitFor(() => expect(view.getByText('Cannot load the public status')).toBeTruthy())
        expect(view.getByRole('link', { name: /Check detailed system status/ })).toBeTruthy()
    })

    test('S2 to S9: all good inside, every card with its numbers, running sandboxes only', async () => {
        mockApi(health())
        const view = renderTab()
        await waitFor(() => expect(view.getByText('Inside: all good')).toBeTruthy())
        for (const title of ['Server', 'Machine', 'Database and Redis', 'Queues', 'Workers (1)']) {
            expect(view.getByRole('region', { name: title })).toBeTruthy()
        }
        const text = (name: string) => view.getByRole('region', { name }).textContent ?? ''
        expect(text('Server')).toContain('5 min')
        expect(text('Server')).toContain('abcdef1')
        expect(text('Server')).toContain('4 ms (p99)')
        expect(text('Machine')).toContain('0.2 · 0.3 · 0.3 on 2 cores')
        expect(text('Machine')).toContain('40% · 8 GB of 20 GB, 12 GB free')
        expect(text('Database and Redis')).toContain('5 of 100')
        expect(text('Database and Redis')).toContain('3 MB of 256 MB')
        expect(text('Workers (1)')).toContain('12 done · 1 failed')
        expect(text('Queues')).toContain('Agent runs')
        expect(view.getByText('No server errors in 24 hours')).toBeTruthy()
        expect(view.getByText('1 running · 0 starting · 2 paused')).toBeTruthy()
        await waitFor(() => expect(view.getByText('runner@example.com')).toBeTruthy())
        expect(view.queryByText('paused@example.com')).toBeNull()
        expect(view.queryByText('Failed jobs')).toBeNull()
    })

    test('S10: a nearly full disk and a failed job show up at the top and in a short list', async () => {
        mockApi(health({ diskUsedPct: 86, machineStatus: 'warn' }), [
            {
                queue: 'agent_jobs',
                id: '1',
                name: 'run',
                reason: 'sandbox timed out',
                attempts: 3,
                failedAt: new Date().toISOString(),
            },
        ])
        const view = renderTab()
        await waitFor(() =>
            expect(view.getByText(/Needs a look: machine: disk 86% used/)).toBeTruthy()
        )
        await waitFor(() => expect(view.getByText('sandbox timed out')).toBeTruthy())
        expect(view.getByText('Failed jobs')).toBeTruthy()
    })

    test('C3: before Cloudflare is connected, one short line', async () => {
        mockApi(health())
        const view = renderTab()
        await waitFor(() => expect(view.getByText('Cloudflare is not connected yet')).toBeTruthy())
    })

    test('C3 to C5: one small Cloudflare card: last deploy per site, 24 hours, page loads', async () => {
        mockApi(health(), [], publicStatus, connectedDeploys, edgeData, speedData)
        const view = renderTab()
        await waitFor(() => expect(view.getByRole('region', { name: 'Cloudflare' })).toBeTruthy())
        const card = view.getByRole('region', { name: 'Cloudflare' }).textContent ?? ''
        // the newest deploy of each project, and a token error in its own words
        expect(card).toContain('december-web · feat: new admin')
        expect(card).toContain('Failed · abc1234')
        expect(card).toContain('Authentication error')
        expect(card).toContain('4,530 requests · 5 5xx · 63 blocked · 24% cached')
        expect(card).toContain('1.1 s · 97% good')
        // a slow web app (4.6 s) shows in red
        expect(view.getByText('4.6 s').className).toContain('F28B82')
    })

    test('C4, C5: a Cloudflare error shows its own text', async () => {
        mockApi(
            health(),
            [],
            publicStatus,
            connectedDeploys,
            {
                connected: true,
                error: 'Authentication error',
            },
            speedData
        )
        const view = renderTab()
        await waitFor(() => expect(view.getByText('Edge: Authentication error')).toBeTruthy())
    })

    test('B2: Stop asks first, then the row says "Stopping…" so it is not sent twice', async () => {
        const sent: string[] = []
        mockApi(health())
        adminAPI.controlSandbox = (async (id: string, action: string) => {
            sent.push(`${id}:${action}`)
            return { sessionId: id, action }
        }) as any
        const view = renderTab()
        await waitFor(() => expect(view.getByText('runner@example.com')).toBeTruthy())
        fireEvent.click(view.getByRole('button', { name: 'Stop' }))
        expect(sent).toEqual([])
        expect(view.getByText('The agent is working. Stop it?')).toBeTruthy()
        fireEvent.click(view.getByRole('button', { name: 'Stop' }))
        await waitFor(() => expect(view.getByText('Stopping…')).toBeTruthy())
        expect(sent).toEqual(['s1:stop'])
        expect(view.queryByRole('button', { name: 'Stop' })).toBeNull()
        // no session title, only an id
        expect(view.queryByText(/busy/)).toBeNull()
    })
})
