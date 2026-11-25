import { createHash } from 'node:crypto'

import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { byokUtils } from '../../src/modules/byok/byok.utils'
import { setEmailQueue } from '../../src/modules/email/email.queue'
import { cleanupTestUser, createSignedInUser, getRandomIP, signInWithEmailCode } from '../helpers'

// #640, the base of team accounts: a team for each user, invites, roles and the audit log
describe('team accounts (the base)', () => {
    const stamp = Date.now()
    const emails = {
        owner: `team-owner-${stamp}@example.com`,
        admin: `team-admin-${stamp}@example.com`,
        secondAdmin: `team-admin2-${stamp}@example.com`,
        member: `team-member-${stamp}@example.com`,
        outsider: `team-outsider-${stamp}@example.com`,
        unverified: `team-unverified-${stamp}@example.com`,
    }
    type TestUser = { userId: string; token: string }
    const users = {} as Record<keyof typeof emails, TestUser>
    const mails: Array<{ to: string; subject: string; text: string }> = []
    const DAY_MS = 24 * 60 * 60 * 1000
    const webUrl = env.APP_URL.replace(/\/+$/, '')

    // the token is only in the mail, in the link <web url>/invite/<token>
    const tokenFromMail = (to: string): string => {
        const mail = [...mails].reverse().find((m) => m.to === to)
        return mail?.text.match(/\/invite\/([A-Za-z0-9_-]+)/)?.[1] ?? ''
    }

    const as = (user: TestUser) => {
        const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
            request(app)
                [method](`/api/v1/team${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${user.token}`)
        return {
            get: (path = '') => call('get', path),
            post: (path: string, body: object = {}) => call('post', path).send(body),
            patch: (path: string, body: object = {}) => call('patch', path).send(body),
            delete: (path: string) => call('delete', path),
        }
    }

    // the mail queue of the server, kept in memory: the tests read what was queued
    const mailQueue = {
        add: async (_name: string, data: { to: string; subject: string; text: string }) => {
            mails.push({ to: data.to, subject: data.subject, text: data.text })
            return { id: `mail-${mails.length}` }
        },
    } as any

    beforeAll(async () => {
        // team accounts are off by default: these tests run with the switch on
        env.TEAMS_ENABLED = true
        setEmailQueue(mailQueue)

        users.owner = await createSignedInUser({ email: emails.owner, name: 'Asha Rao' })
        users.admin = await createSignedInUser({ email: emails.admin, name: 'Arjun Mehta' })
        users.secondAdmin = await createSignedInUser({
            email: emails.secondAdmin,
            name: 'Meera Iyer',
        })
        users.member = await createSignedInUser({ email: emails.member, name: 'Kabir Das' })
        users.outsider = await createSignedInUser({ email: emails.outsider, name: 'Nisha Roy' })
        users.unverified = await createSignedInUser({
            email: emails.unverified,
            name: 'Dev Shah',
            emailVerified: false,
        })
    })

    afterAll(async () => {
        env.TEAMS_ENABLED = false
        setEmailQueue(null)
        // the teams, members, invites and audit rows go with their users
        for (const user of Object.values(users)) {
            await cleanupTestUser({ id: user.userId })
        }
    })

    it('a new user gets a team on the first read', async () => {
        expect(await prisma.team.count({ where: { ownerId: users.owner.userId } })).toBe(0)

        const res = await as(users.owner).get()

        expect(res.status).toBe(200)
        expect(res.body.data.team.name).toBe('Asha Rao')
        expect(res.body.data.role).toBe('OWNER')
        expect(res.body.data.members).toEqual([
            {
                userId: users.owner.userId,
                name: 'Asha Rao',
                email: emails.owner,
                role: 'OWNER',
                joinedAt: expect.any(String),
            },
        ])
        expect(res.body.data.invites).toEqual([])
        expect(res.body.data.memberOf).toEqual([])

        // a second read gives the same team
        const again = await as(users.owner).get()
        expect(again.body.data.team.id).toBe(res.body.data.team.id)
        expect(await prisma.team.count({ where: { ownerId: users.owner.userId } })).toBe(1)
    })

    it('needs a signed-in user', async () => {
        const res = await request(app).get('/api/v1/team').set('x-forwarded-for', getRandomIP())
        expect(res.status).toBe(401)
    })

    it('an invite saves only a hash of the token and queues a mail with the link', async () => {
        const res = await as(users.owner).post('/invites', {
            email: ` ${emails.admin.toUpperCase()} `,
            role: 'ADMIN',
        })

        expect(res.status).toBe(201)
        expect(res.body.data.invite.email).toBe(emails.admin)
        expect(res.body.data.invite.role).toBe('ADMIN')
        // valid for 7 days
        const validMs = new Date(res.body.data.invite.expiresAt).getTime() - Date.now()
        expect(validMs).toBeGreaterThan(7 * DAY_MS - 60_000)
        expect(validMs).toBeLessThanOrEqual(7 * DAY_MS)

        const mail = mails.find((m) => m.to === emails.admin)
        expect(mail?.subject).toBe('Asha Rao invited you to a team on December')
        expect(mail?.text).toContain(`${webUrl}/invite/`)
        const token = tokenFromMail(emails.admin)
        expect(token.length).toBeGreaterThanOrEqual(40)

        // the token is in the mail only: the reply does not have it, the table has its hash
        expect(JSON.stringify(res.body)).not.toContain(token)
        const row = await prisma.teamInvite.findUnique({
            where: { id: res.body.data.invite.id },
        })
        expect(row?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
        expect(row?.tokenHash).not.toContain(token)

        const team = await as(users.owner).get()
        expect(team.body.data.invites).toEqual([
            {
                id: res.body.data.invite.id,
                email: emails.admin,
                role: 'ADMIN',
                invitedBy: 'Asha Rao',
                expiresAt: res.body.data.invite.expiresAt,
                createdAt: expect.any(String),
            },
        ])
    })

    it('the invite page reads the team, the inviter and the role, with the email masked', async () => {
        const token = tokenFromMail(emails.admin)

        // no sign-in is needed to read it
        const res = await request(app)
            .get(`/api/v1/team/invites/${token}`)
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({
            teamName: 'Asha Rao',
            inviterName: 'Asha Rao',
            role: 'ADMIN',
            email: 't***@example.com',
            expired: false,
        })

        const unknown = await request(app)
            .get('/api/v1/team/invites/not-a-real-token')
            .set('x-forwarded-for', getRandomIP())
        expect(unknown.status).toBe(404)
    })

    it('the invited user accepts and joins the team with the role of the invite', async () => {
        const token = tokenFromMail(emails.admin)

        const res = await as(users.admin).post('/invites/accept', { token })

        expect(res.status).toBe(200)
        expect(res.body.data.team.name).toBe('Asha Rao')
        expect(res.body.data.role).toBe('ADMIN')

        const team = await as(users.owner).get()
        expect(team.body.data.invites).toEqual([])
        expect(team.body.data.members.map((m: any) => [m.email, m.role])).toEqual([
            [emails.owner, 'OWNER'],
            [emails.admin, 'ADMIN'],
        ])

        // the new member sees the team under "teams you are in", next to their own team
        const own = await as(users.admin).get()
        expect(own.body.data.role).toBe('OWNER')
        expect(own.body.data.team.name).toBe('Arjun Mehta')
        expect(own.body.data.memberOf).toEqual([
            {
                teamId: team.body.data.team.id,
                name: 'Asha Rao',
                ownerName: 'Asha Rao',
                role: 'ADMIN',
            },
        ])
    })

    it('a used token is refused', async () => {
        const token = tokenFromMail(emails.admin)

        const res = await as(users.admin).post('/invites/accept', { token })
        expect(res.status).toBe(409)

        // the invite page has nothing to show for it
        const preview = await request(app)
            .get(`/api/v1/team/invites/${token}`)
            .set('x-forwarded-for', getRandomIP())
        expect(preview.status).toBe(404)
    })

    it('no second invite for a member or for an email with an open invite', async () => {
        const member = await as(users.owner).post('/invites', {
            email: emails.admin,
            role: 'MEMBER',
        })
        expect(member.status).toBe(409)
        expect(member.body.message).toBe('this person is in the team already')

        const first = await as(users.owner).post('/invites', {
            email: emails.member,
            role: 'MEMBER',
        })
        expect(first.status).toBe(201)
        const second = await as(users.owner).post('/invites', {
            email: emails.member.toUpperCase(),
            role: 'ADMIN',
        })
        expect(second.status).toBe(409)
        expect(second.body.message).toBe('this person has an invite already')

        expect(mails.filter((m) => m.to === emails.member)).toHaveLength(1)
    })

    it('an invite needs a real email and a role of admin or member', async () => {
        const badEmail = await as(users.owner).post('/invites', {
            email: 'not-an-email',
            role: 'MEMBER',
        })
        expect(badEmail.status).toBe(400)

        const ownerRole = await as(users.owner).post('/invites', {
            email: `team-nobody-${stamp}@example.com`,
            role: 'OWNER',
        })
        expect(ownerRole.status).toBe(400)
    })

    it('an invite whose mail cannot be queued is not kept', async () => {
        const email = `team-nomail-${stamp}@example.com`
        setEmailQueue({
            add: async () => {
                throw new Error('queue is down')
            },
        } as any)
        const res = await as(users.owner).post('/invites', { email, role: 'MEMBER' })
        setEmailQueue(mailQueue)

        expect(res.status).toBe(503)
        expect(await prisma.teamInvite.count({ where: { email } })).toBe(0)
    })

    it('accept with the account of another email is refused', async () => {
        const token = tokenFromMail(emails.member)

        const res = await as(users.outsider).post('/invites/accept', { token })

        expect(res.status).toBe(403)
        expect(res.body.message).toBe('this invite is for another email address')
        const team = await as(users.owner).get()
        expect(team.body.data.members.map((m: any) => m.email)).not.toContain(emails.outsider)

        // the invite page tells a signed-in reader if the invite is for this account
        const wrong = await as(users.outsider).get(`/invites/${token}`)
        expect(wrong.body.data.emailMatches).toBe(false)
        expect(wrong.body.data.email).toBe('t***@example.com')
        const right = await as(users.member).get(`/invites/${token}`)
        expect(right.body.data.emailMatches).toBe(true)
    })

    it('accept needs a verified email', async () => {
        const invite = await as(users.owner).post('/invites', {
            email: emails.unverified,
            role: 'MEMBER',
        })
        expect(invite.status).toBe(201)

        const res = await as(users.unverified).post('/invites/accept', {
            token: tokenFromMail(emails.unverified),
        })

        expect(res.status).toBe(403)
        expect(res.body.message).toBe('verify your email address to join a team')
    })

    it('a revoked token is refused', async () => {
        const team = await as(users.owner).get()
        const invite = team.body.data.invites.find((i: any) => i.email === emails.unverified)

        const revoke = await as(users.owner).delete(`/invites/${invite.id}`)
        expect(revoke.status).toBe(200)

        const after = await as(users.owner).get()
        expect(after.body.data.invites.map((i: any) => i.email)).toEqual([emails.member])

        // the email is verified now, so only the revoke stops the accept
        await prisma.user.update({
            where: { id: users.unverified.userId },
            data: { emailVerified: true },
        })
        const res = await as(users.unverified).post('/invites/accept', {
            token: tokenFromMail(emails.unverified),
        })
        expect(res.status).toBe(404)

        // a revoked invite cannot be revoked again
        const again = await as(users.owner).delete(`/invites/${invite.id}`)
        expect(again.status).toBe(404)
    })

    it('an expired token is refused, and the invite page says it is expired', async () => {
        const token = tokenFromMail(emails.member)
        const row = await prisma.teamInvite.findFirst({
            where: { email: emails.member, acceptedAt: null, revokedAt: null },
        })
        await prisma.teamInvite.update({
            where: { id: row!.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
        })

        const res = await as(users.member).post('/invites/accept', { token })
        expect(res.status).toBe(410)

        const preview = await as(users.member).get(`/invites/${token}`)
        expect(preview.status).toBe(200)
        expect(preview.body.data.expired).toBe(true)

        // an expired invite does not stop a new one
        const team = await as(users.owner).get()
        expect(team.body.data.invites).toEqual([])
        const fresh = await as(users.owner).post('/invites', {
            email: emails.member,
            role: 'MEMBER',
        })
        expect(fresh.status).toBe(201)
        const join = await as(users.member).post('/invites/accept', {
            token: tokenFromMail(emails.member),
        })
        expect(join.status).toBe(200)
        expect(join.body.data.role).toBe('MEMBER')
    })

    // from here the team of Asha has: Asha (owner), Arjun (admin), Kabir (member)
    const teamIdOf = async (user: TestUser) => (await as(user).get()).body.data.team.id as string
    const rolesIn = async (teamId: string) => {
        const rows = await prisma.teamMember.findMany({
            where: { teamId },
            select: { role: true, user: { select: { email: true } } },
        })
        return Object.fromEntries(rows.map((row) => [row.user.email, row.role]))
    }

    it('a member reads the team but cannot invite, and sees no invites', async () => {
        const teamId = await teamIdOf(users.owner)
        await as(users.owner).post('/invites', { email: emails.outsider, role: 'MEMBER' })

        const read = await as(users.member).get(`?teamId=${teamId}`)
        expect(read.status).toBe(200)
        expect(read.body.data.role).toBe('MEMBER')
        expect(read.body.data.members).toHaveLength(3)
        expect(read.body.data.invites).toEqual([])

        const invite = await as(users.member).post(`/invites?teamId=${teamId}`, {
            email: `team-nobody-${stamp}@example.com`,
            role: 'MEMBER',
        })
        expect(invite.status).toBe(403)

        const openInvite = (await as(users.owner).get()).body.data.invites[0]
        const revoke = await as(users.member).delete(`/invites/${openInvite.id}?teamId=${teamId}`)
        expect(revoke.status).toBe(403)

        // the audit log is for the owner and the admins
        const audit = await as(users.member).get(`/audit?teamId=${teamId}`)
        expect(audit.status).toBe(403)
        const exported = await as(users.member).get(`/audit/export?teamId=${teamId}`)
        expect(exported.status).toBe(403)
    })

    it('an admin invites a member and revokes an invite, but cannot invite an admin', async () => {
        const teamId = await teamIdOf(users.owner)

        const asAdmin = await as(users.admin).post(`/invites?teamId=${teamId}`, {
            email: emails.secondAdmin,
            role: 'ADMIN',
        })
        expect(asAdmin.status).toBe(403)

        const asMember = await as(users.admin).post(`/invites?teamId=${teamId}`, {
            email: emails.secondAdmin,
            role: 'MEMBER',
        })
        expect(asMember.status).toBe(201)

        const read = await as(users.admin).get(`?teamId=${teamId}`)
        expect(read.body.data.invites.map((i: any) => i.email).sort()).toEqual(
            [emails.secondAdmin, emails.outsider].sort()
        )
        const outsiderInvite = read.body.data.invites.find((i: any) => i.email === emails.outsider)
        const revoke = await as(users.admin).delete(
            `/invites/${outsiderInvite.id}?teamId=${teamId}`
        )
        expect(revoke.status).toBe(200)

        const join = await as(users.secondAdmin).post('/invites/accept', {
            token: tokenFromMail(emails.secondAdmin),
        })
        expect(join.status).toBe(200)
    })

    it('only the owner changes a role, and the role of the owner cannot change', async () => {
        const teamId = await teamIdOf(users.owner)
        const path = `/members/${users.secondAdmin.userId}`

        const byAdmin = await as(users.admin).patch(`${path}?teamId=${teamId}`, { role: 'ADMIN' })
        expect(byAdmin.status).toBe(403)
        const byMember = await as(users.member).patch(`${path}?teamId=${teamId}`, {
            role: 'ADMIN',
        })
        expect(byMember.status).toBe(403)
        expect((await rolesIn(teamId))[emails.secondAdmin]).toBe('MEMBER')

        const byOwner = await as(users.owner).patch(path, { role: 'ADMIN' })
        expect(byOwner.status).toBe(200)
        expect(byOwner.body.data.member).toEqual({
            userId: users.secondAdmin.userId,
            name: 'Meera Iyer',
            email: emails.secondAdmin,
            role: 'ADMIN',
            joinedAt: expect.any(String),
        })
        expect((await rolesIn(teamId))[emails.secondAdmin]).toBe('ADMIN')

        const ownRole = await as(users.owner).patch(`/members/${users.owner.userId}`, {
            role: 'ADMIN',
        })
        expect(ownRole.status).toBe(400)
        const makeOwner = await as(users.owner).patch(path, { role: 'OWNER' })
        expect(makeOwner.status).toBe(400)
        const notAMember = await as(users.owner).patch(`/members/${users.outsider.userId}`, {
            role: 'ADMIN',
        })
        expect(notAMember.status).toBe(404)
        expect((await rolesIn(teamId))[emails.owner]).toBe('OWNER')
    })

    it('an admin cannot remove an admin or the owner, and a member removes nobody', async () => {
        const teamId = await teamIdOf(users.owner)

        const admin = await as(users.admin).delete(
            `/members/${users.secondAdmin.userId}?teamId=${teamId}`
        )
        expect(admin.status).toBe(403)

        const owner = await as(users.admin).delete(
            `/members/${users.owner.userId}?teamId=${teamId}`
        )
        expect(owner.status).toBe(403)

        const byMember = await as(users.member).delete(
            `/members/${users.admin.userId}?teamId=${teamId}`
        )
        expect(byMember.status).toBe(403)

        // the owner cannot leave the team
        const ownerLeaves = await as(users.owner).delete(`/members/${users.owner.userId}`)
        expect(ownerLeaves.status).toBe(400)

        expect(await rolesIn(teamId)).toEqual({
            [emails.owner]: 'OWNER',
            [emails.admin]: 'ADMIN',
            [emails.secondAdmin]: 'ADMIN',
            [emails.member]: 'MEMBER',
        })
    })

    it('a user outside the team gets 404 for every route of that team', async () => {
        const teamId = await teamIdOf(users.owner)
        const outsider = as(users.outsider)

        const replies = await Promise.all([
            outsider.get(`?teamId=${teamId}`),
            outsider.post(`/invites?teamId=${teamId}`, {
                email: `team-nobody-${stamp}@example.com`,
                role: 'MEMBER',
            }),
            outsider.delete(`/invites/${users.owner.userId}?teamId=${teamId}`),
            outsider.patch(`/members/${users.member.userId}?teamId=${teamId}`, { role: 'ADMIN' }),
            outsider.delete(`/members/${users.member.userId}?teamId=${teamId}`),
            outsider.delete(`/members/${users.outsider.userId}?teamId=${teamId}`),
            outsider.get(`/audit?teamId=${teamId}`),
            outsider.get(`/audit/export?teamId=${teamId}`),
        ])

        expect(replies.map((res) => res.status)).toEqual([404, 404, 404, 404, 404, 404, 404, 404])
        expect((await rolesIn(teamId))[emails.member]).toBe('MEMBER')
        // the user's own team has none of the other team's members
        const own = await outsider.get()
        expect(own.body.data.members.map((m: any) => m.email)).toEqual([emails.outsider])
    })

    it('an admin removes a member, and a member leaves', async () => {
        const teamId = await teamIdOf(users.owner)

        const remove = await as(users.admin).delete(
            `/members/${users.member.userId}?teamId=${teamId}`
        )
        expect(remove.status).toBe(200)
        expect((await rolesIn(teamId))[emails.member]).toBeUndefined()
        // the removed user has no role in the team any more
        const read = await as(users.member).get(`?teamId=${teamId}`)
        expect(read.status).toBe(404)

        const leave = await as(users.secondAdmin).delete(
            `/members/${users.secondAdmin.userId}?teamId=${teamId}`
        )
        expect(leave.status).toBe(200)
        expect(await rolesIn(teamId)).toEqual({
            [emails.owner]: 'OWNER',
            [emails.admin]: 'ADMIN',
        })
        const own = await as(users.secondAdmin).get()
        expect(own.body.data.memberOf).toEqual([])
    })

    // what the tests above did in the team of Asha, oldest first:
    // invited x6 (Arjun, Kabir, Dev, Kabir again, Nisha, Meera), joined x3 (Arjun, Kabir,
    // Meera), invite_revoked x2 (Dev, Nisha), role_changed x1, removed x1, left x1
    it('the audit list has a row for every member change, newest first', async () => {
        const invite = await request(app)
            .post('/api/v1/team/invites')
            .set('x-forwarded-for', '203.0.113.7')
            .set('Authorization', `Bearer ${users.owner.token}`)
            .send({ email: `team-nobody-${stamp}@example.com`, role: 'ADMIN' })
        expect(invite.status).toBe(201)

        const res = await as(users.owner).get('/audit?limit=100')

        expect(res.status).toBe(200)
        const events = res.body.data.events as any[]
        expect(res.body.data.pagination).toEqual({ total: 15, page: 1, limit: 100, totalPages: 1 })
        const count = (action: string) => events.filter((e) => e.action === action).length
        expect({
            invited: count('member.invited'),
            revoked: count('member.invite_revoked'),
            joined: count('member.joined'),
            roleChanged: count('member.role_changed'),
            removed: count('member.removed'),
            left: count('member.left'),
        }).toEqual({ invited: 7, revoked: 2, joined: 3, roleChanged: 1, removed: 1, left: 1 })

        const times = events.map((e) => new Date(e.createdAt).getTime())
        expect(times).toEqual([...times].sort((a, b) => b - a))

        // the newest row: who did it, to whom, from which address
        expect(events[0]).toEqual({
            id: expect.any(String),
            action: 'member.invited',
            target: `team-nobody-${stamp}@example.com`,
            ip: '203.0.113.7',
            metadata: { role: 'ADMIN' },
            createdAt: expect.any(String),
            actor: { id: users.owner.userId, name: 'Asha Rao', email: emails.owner },
        })
        const pick = (action: string) => {
            const event = events.find((e) => e.action === action)
            return { actor: event.actor.email, target: event.target, metadata: event.metadata }
        }
        expect(pick('member.left')).toEqual({
            actor: emails.secondAdmin,
            target: emails.secondAdmin,
            metadata: { role: 'ADMIN' },
        })
        expect(pick('member.removed')).toEqual({
            actor: emails.admin,
            target: emails.member,
            metadata: { role: 'MEMBER' },
        })
        expect(pick('member.role_changed')).toEqual({
            actor: emails.owner,
            target: emails.secondAdmin,
            metadata: { from: 'MEMBER', to: 'ADMIN' },
        })
        expect(pick('member.joined')).toEqual({
            actor: emails.secondAdmin,
            target: emails.secondAdmin,
            metadata: { role: 'MEMBER' },
        })
        expect(pick('member.invite_revoked')).toEqual({
            actor: emails.admin,
            target: emails.outsider,
            metadata: { role: 'MEMBER' },
        })
    })

    it('the audit list filters by action, actor and date, and has pages', async () => {
        const teamId = await teamIdOf(users.owner)
        const list = async (query: string) => {
            const res = await as(users.owner).get(`/audit?${query}`)
            expect(res.status).toBe(200)
            return res.body.data
        }

        const invited = await list('action=member.invited')
        expect(invited.events).toHaveLength(7)
        expect(new Set(invited.events.map((e: any) => e.action))).toEqual(
            new Set(['member.invited'])
        )

        // Arjun: joined, invited Meera, revoked the invite of Nisha, removed Kabir
        const byAdmin = await list(`actorId=${users.admin.userId}`)
        expect(byAdmin.events.map((e: any) => e.action)).toEqual([
            'member.removed',
            'member.invite_revoked',
            'member.invited',
            'member.joined',
        ])
        const both = await list(`actorId=${users.admin.userId}&action=member.invited`)
        expect(both.events.map((e: any) => e.target)).toEqual([emails.secondAdmin])

        const sinceStart = await list(`from=${new Date(stamp - 60_000).toISOString()}`)
        expect(sinceStart.pagination.total).toBe(15)
        const future = await list(`from=${new Date(Date.now() + DAY_MS).toISOString()}`)
        expect(future.events).toEqual([])
        const past = await list(`to=${new Date(stamp - 60_000).toISOString()}`)
        expect(past.events).toEqual([])

        const pageOne = await list('limit=6&page=1')
        expect(pageOne.events).toHaveLength(6)
        expect(pageOne.pagination).toEqual({ total: 15, page: 1, limit: 6, totalPages: 3 })
        const pageThree = await list('limit=6&page=3')
        expect(pageThree.events).toHaveLength(3)
        const ids = new Set([...pageOne.events, ...pageThree.events].map((e: any) => e.id))
        expect(ids.size).toBe(9)

        // an admin reads it too, and each team has its own log
        const asAdmin = await as(users.admin).get(`/audit?teamId=${teamId}`)
        expect(asAdmin.status).toBe(200)
        expect(asAdmin.body.data.pagination.total).toBe(15)
        const ownTeam = await as(users.admin).get('/audit')
        expect(ownTeam.body.data.events).toEqual([])

        const badDate = await as(users.owner).get('/audit?from=not-a-date')
        expect(badDate.status).toBe(400)
    })

    it('the csv export has the filtered rows and escapes formula cells', async () => {
        const teamId = await teamIdOf(users.owner)
        // a display name and targets that a spreadsheet would run as a formula
        await prisma.user.update({
            where: { id: users.admin.userId },
            data: { name: '=HYPERLINK("http://example.com","x")' },
        })
        const actorId = users.owner.userId
        await prisma.auditEvent.createMany({
            data: [
                // secret events are personal: only their actor reads them (review C6)
                { teamId, actorId, action: 'secret.created', target: '+SUM(A1:A2)' },
                { teamId, actorId, action: 'secret.created', target: '-2+3' },
                { teamId, actorId, action: 'secret.created', target: '@cmd' },
            ],
        })

        const res = await as(users.owner).get('/audit/export')

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toContain('text/csv')
        expect(res.headers['content-disposition']).toContain('attachment; filename="audit-log.csv"')
        const lines = res.text.trim().split('\r\n')
        expect(lines[0]).toBe('time,actor,email,action,target,ip,details')
        expect(lines).toHaveLength(1 + 18)

        // a leading ' makes the cell text. quotes are doubled inside a quoted cell
        expect(res.text).toContain(`"'=HYPERLINK(""http://example.com"",""x"")"`)
        expect(res.text).toContain(`,secret.created,'+SUM(A1:A2),`)
        expect(res.text).toContain(`,secret.created,'-2+3,`)
        expect(res.text).toContain(`,secret.created,'@cmd,`)
        expect(res.text).not.toMatch(/(^|,)"?[=+\-@]/m)

        const left = await as(users.owner).get('/audit/export?action=member.left')
        const leftLines = left.text.trim().split('\r\n')
        expect(leftLines).toHaveLength(2)
        expect(leftLines[1]).toContain(`,Meera Iyer,${emails.secondAdmin},member.left,`)
        expect(leftLines[1]).toContain(`"{""role"":""ADMIN""}"`)
    })

    // review C6: sign-in ips, secret and key names and top-up amounts of the owner
    it('the personal events of the owner are for the owner only, in the list and the export', async () => {
        const teamId = await teamIdOf(users.owner)
        const actorId = users.owner.userId
        await prisma.auditEvent.createMany({
            data: [
                { teamId, actorId, action: 'auth.sign_in', ip: '203.0.113.9' },
                { teamId, actorId, action: 'secret.updated', target: 'OWNER_PRIVATE_SECRET' },
                { teamId, actorId, action: 'key.created', target: 'owner-key-provider' },
                { teamId, actorId, action: 'billing.top_up', target: '$25.00' },
                { teamId, actorId, action: 'billing.limits_changed', target: 'dayLimitCents' },
            ],
        })
        const personal = [
            'auth.sign_in',
            'secret.created',
            'secret.updated',
            'key.created',
            'billing.top_up',
            'billing.limits_changed',
        ]
        const actionsOf = (res: any) => new Set(res.body.data.events.map((e: any) => e.action))

        const asOwner = await as(users.owner).get('/audit?limit=100')
        for (const action of personal) expect(actionsOf(asOwner).has(action)).toBe(true)

        const asAdmin = await as(users.admin).get(`/audit?teamId=${teamId}&limit=100`)
        expect(asAdmin.status).toBe(200)
        for (const action of personal) expect(actionsOf(asAdmin).has(action)).toBe(false)
        // member events stay visible to the admins
        expect(actionsOf(asAdmin).has('member.invited')).toBe(true)
        expect(asAdmin.body.data.pagination.total).toBe(asOwner.body.data.pagination.total - 8)

        const filtered = await as(users.admin).get(`/audit?teamId=${teamId}&action=billing.top_up`)
        expect(filtered.body.data.events).toEqual([])
        expect(filtered.body.data.pagination.total).toBe(0)

        const exported = await as(users.admin).get(`/audit/export?teamId=${teamId}`)
        expect(exported.status).toBe(200)
        for (const secret of [
            '203.0.113.9',
            'OWNER_PRIVATE_SECRET',
            'owner-key-provider',
            '$25.00',
        ]) {
            expect(exported.text).not.toContain(secret)
        }
        expect(exported.text).toContain(',member.invited,')
        const ownExport = await as(users.owner).get('/audit/export')
        expect(ownExport.text).toContain('OWNER_PRIVATE_SECRET')
    })

    it('sign-in, secret and key changes go in the log of the own team of the user', async () => {
        const secretName = `TEAM_TEST_${stamp}`
        const savedVerify = byokUtils.verifyKey
        // no network in tests: every key passes the check
        byokUtils.verifyKey = (async () => ({
            ok: true,
            models: ['llama-3.3-70b-versatile'],
            defaultModel: 'llama-3.3-70b-versatile',
        })) as any
        const call = (method: 'post' | 'put' | 'delete', path: string) =>
            request(app)
                [method](`/api/v1${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${users.outsider.token}`)

        try {
            const signIn = await signInWithEmailCode(app, emails.outsider)
            expect(signIn.status).toBe(200)
            const saved = await call('post', '/secrets').send({ name: secretName, value: 'v1' })
            expect(saved.status).toBe(201)
            // the same name again changes the value: that is an update (review B6)
            const changed = await call('post', '/secrets').send({ name: secretName, value: 'v2' })
            expect(changed.status).toBe(201)
            // review C9: a change of the spend limits is a billing change
            const limits = await request(app)
                .patch('/api/v1/billing/limits')
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${users.outsider.token}`)
                .send({ dayLimitCents: 2500 })
            expect(limits.status).toBe(200)
            expect((await call('delete', `/secrets/${secretName}`)).status).toBe(200)
            const key = await call('put', '/byok/groq').send({ apiKey: 'gsk_team_test_key_4242' })
            expect(key.status).toBe(200)
            expect((await call('delete', '/byok/groq')).status).toBe(200)
        } finally {
            byokUtils.verifyKey = savedVerify
        }

        const res = await as(users.outsider).get('/audit')
        const events = res.body.data.events as any[]
        expect(events.map((e) => [e.action, e.target])).toEqual([
            ['key.deleted', 'groq'],
            ['key.created', 'groq'],
            ['secret.deleted', secretName],
            ['billing.limits_changed', 'dayLimitCents'],
            ['secret.updated', secretName],
            ['secret.created', secretName],
            ['auth.sign_in', null],
        ])
        expect(new Set(events.map((e) => e.actor.email))).toEqual(new Set([emails.outsider]))
        expect(events[3].metadata).toEqual({ dayLimitCents: 2500 })
        expect(events[6].metadata).toEqual({ method: 'email' })
        expect(events[6].ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/)

        // the team of Asha has none of these rows
        const other = await as(users.owner).get('/audit?action=secret.deleted')
        expect(other.body.data.events).toEqual([])
    })
})

describe('Team accounts are off by default (#640)', () => {
    it('answers 404 on every team route, signed in or not', async () => {
        const email = `team-off-${Date.now()}@example.com`
        const user = await createSignedInUser({ email, name: 'Off' })
        const wasOn = env.TEAMS_ENABLED
        env.TEAMS_ENABLED = false
        try {
            const auth = { Authorization: `Bearer ${user.token}` }
            const team = await request(app).get('/api/v1/team').set(auth)
            const invite = await request(app)
                .post('/api/v1/team/invites')
                .set(auth)
                .send({ email: 'friend@example.com', role: 'MEMBER' })
            const preview = await request(app).get('/api/v1/team/invites/any-token')
            const audit = await request(app).get('/api/v1/team/audit').set(auth)
            expect([team.status, invite.status, preview.status, audit.status]).toEqual([
                404, 404, 404, 404,
            ])
        } finally {
            env.TEAMS_ENABLED = wasOn
            await cleanupTestUser({ email })
        }
    })
})
