import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import bcrypt from 'bcrypt'
import { prisma } from '../../../src/config/db'

const sendOTPMock = mock(async (_email: String, _otp: String) => {})

mock.module('../../../src/modules/auth/auth.utils', () => ({
    sendOTP: sendOTPMock,
    getUsernameFromEmail: (email: String) => email.split('@')[0]?.replace(/\d+/g, ''),
}))

import { authService } from '../../../src/modules/auth/auth.service'

describe('authService integration', () => {
    beforeEach(async () => {
        sendOTPMock.mockClear()
        await prisma.user.deleteMany()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it('should create a new unverified user with hashed password and otp on signup', async () => {
        const email = 'test@example.com'
        const password = 'Password123'

        const result = await authService.signup({ email, password })

        expect(result).toEqual({
            message: 'otp sent successfully',
        })

        const user = await prisma.user.findUnique({
            where: {
                email: email,
            },
        })

        expect(user).not.toBeNull()
        expect(user!.email).toBe(email)
        expect(user!.name).toBe('test')
        expect(user!.username).toBe('test')
        expect(user!.emailVerified).toBe(false)
        expect(user!.otpHash).toBeTruthy()
        expect(user!.otpExpiresAt).toBeTruthy()

        expect(user!.password).not.toBe(password)
        const isPasswordValid = await bcrypt.compare(password, user!.password!)

        expect(isPasswordValid).toBe(true)

        expect(sendOTPMock).toHaveBeenCalledTimes(1)

        const firstCallArgs = sendOTPMock.mock.calls[0]
        expect(firstCallArgs![0]).toBe(email)
        expect(firstCallArgs![1]).toBeString()
        expect(firstCallArgs![1]).toHaveLength(6)
    })
})
