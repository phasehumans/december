import { describe, it, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { AuthModalOtpStep } from '@/features/auth/components/AuthModalOtpStep'

describe('AuthModalOtpStep Component', () => {
    const defaultProps = {
        email: 'test@example.com',
        otp: ['', '', '', '', '', ''],
        errorMessage: null,
        isPending: false,
        onChangeOtp: mock(),
        onKeyDown: mock(),
        onPaste: mock(),
        onSubmit: mock((e) => e.preventDefault()),
        onBack: mock(),
        setOtpInputRef: mock(),
    }

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    it('renders correctly with email', () => {
        render(<AuthModalOtpStep {...defaultProps} />)
        expect(screen.getByText('Verify your email')).toBeTruthy()
        expect(screen.getByText('test@example.com')).toBeTruthy()
    })

    it('renders 6 input fields by default', () => {
        const { container } = render(<AuthModalOtpStep {...defaultProps} />)
        const inputs = container.querySelectorAll('input')
        expect(inputs.length).toBe(6)
    })

    it('calls onChangeOtp when input changes', async () => {
        const onChangeOtp = mock()
        const user = userEvent.setup()
        const { container } = render(
            <AuthModalOtpStep {...defaultProps} onChangeOtp={onChangeOtp} />
        )

        const firstInput = container.querySelector('input')
        if (firstInput) {
            await user.type(firstInput, '1')
        }

        expect(onChangeOtp).toHaveBeenCalledWith(0, '1')
    })

    it('disables submit button when OTP is incomplete', () => {
        const { getByRole } = render(
            <AuthModalOtpStep {...defaultProps} otp={['1', '2', '3', '', '', '']} />
        )
        const button = getByRole('button', { name: 'Verify & Continue' }) as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })

    it('enables submit button when OTP is complete', () => {
        const { getByRole } = render(
            <AuthModalOtpStep {...defaultProps} otp={['1', '2', '3', '4', '5', '6']} />
        )
        const button = getByRole('button', { name: 'Verify & Continue' }) as HTMLButtonElement
        expect(button.disabled).toBe(false)
    })

    it('shows error message when provided', () => {
        render(<AuthModalOtpStep {...defaultProps} errorMessage="Invalid code" />)
        expect(screen.getByText('Invalid code')).toBeTruthy()
    })

    it('shows pending state on button when isPending is true', () => {
        const { getByRole } = render(
            <AuthModalOtpStep
                {...defaultProps}
                isPending={true}
                otp={['1', '2', '3', '4', '5', '6']}
            />
        )
        const button = getByRole('button', { name: 'Please wait...' }) as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })
})
