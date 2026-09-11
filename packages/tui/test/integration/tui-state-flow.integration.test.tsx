import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { ChatApp } from '../../src/app'
import { renderWithProviders } from '../test-providers'

describe('TUI State Flow & Menu Transitions (Integration)', () => {
    it('switches between normal prompt view and interactive settings menu', () => {
        const mockAgent = {
            abort: mock(),
            modelOptions: { model: 'claude-3-7-sonnet-latest' },
        } as any

        const baseSession = {
            staticKey: 0,
            staticMessages: [{ id: 'header-1', role: 'header' }],
            activeMessages: [],
            isAuthenticated: true,
            currentEmail: 'engineer@phasehumans.com',
            authMode: 'none',
            grillMode: false,
            setStaticMessages: mock(),
            setStaticKey: mock(),
            setActiveMessages: mock(),
            setAuthMode: mock(),
            handleSubmit: mock(),
            authMethod: 'December Cloud',
            hasBothAuth: true,
            getProviderModels: mock(async () => []),
        }

        const appNormal = renderWithProviders(
            <ChatApp
                agent={mockAgent}
                isAuthenticated={true}
                cliVersion="0.3.9"
                userEmail="engineer@phasehumans.com"
                session={baseSession}
            />
        )

        expect(appNormal.lastFrame()).toContain('December CLI')
        expect(appNormal.lastFrame()).toContain('Ask December to build...')
        appNormal.unmount()

        // Render in settings mode
        const settingsSession = {
            ...baseSession,
            authMode: 'settings_main',
        }

        const appSettings = renderWithProviders(
            <ChatApp
                agent={mockAgent}
                isAuthenticated={true}
                cliVersion="0.3.9"
                userEmail="engineer@phasehumans.com"
                session={settingsSession}
            />
        )

        expect(appSettings.lastFrame()).toContain('Settings')
        expect(appSettings.lastFrame()).not.toContain('Ask December to build...')
        appSettings.unmount()
    })

    it('renders grilling workflow menu and active [GRILL] tag when phase is grilling', () => {
        const mockAgent = {
            abort: mock(),
            modelOptions: { model: 'claude-3-7-sonnet-latest' },
        } as any

        const grillingSession = {
            staticKey: 0,
            staticMessages: [{ id: 'header-1', role: 'header' }],
            activeMessages: [],
            isAuthenticated: true,
            currentEmail: 'engineer@phasehumans.com',
            authMode: 'none',
            grillMode: false,
            planWorkflow: {
                phase: 'grilling',
                prompt: 'Add dark mode',
                questions: [
                    {
                        question: 'Which theme library to use?',
                        options: ['next-themes', 'custom context'],
                    },
                ],
                currentIndex: 0,
                answers: [],
            },
            setStaticMessages: mock(),
            setStaticKey: mock(),
            setActiveMessages: mock(),
            setAuthMode: mock(),
            handleSubmit: mock(),
            authMethod: 'December Cloud',
            hasBothAuth: true,
            getProviderModels: mock(async () => []),
        }

        const appGrill = renderWithProviders(
            <ChatApp
                agent={mockAgent}
                isAuthenticated={true}
                cliVersion="0.3.9"
                userEmail="engineer@phasehumans.com"
                session={grillingSession}
            />
        )

        const frame = appGrill.lastFrame() || ''
        expect(frame).toContain('Which theme library to use?')
        expect(frame).toContain('next-themes')
        expect(frame).toContain('[GRILL]')
        appGrill.unmount()
    })

    it('renders plan review menu and active [PLAN] tag when phase is reviewing', () => {
        const mockAgent = {
            abort: mock(),
            modelOptions: { model: 'claude-3-7-sonnet-latest' },
        } as any

        const reviewSession = {
            staticKey: 0,
            staticMessages: [{ id: 'header-1', role: 'header' }],
            activeMessages: [],
            isAuthenticated: true,
            currentEmail: 'engineer@phasehumans.com',
            authMode: 'none',
            grillMode: false,
            planWorkflow: {
                phase: 'reviewing',
                prompt: 'Add dark mode',
                planText: '### Implementation Plan\n1. Modify theme.ts\n2. Add ThemeProvider',
                qaPairs: [{ question: 'Which theme library?', answer: 'next-themes' }],
            },
            setStaticMessages: mock(),
            setStaticKey: mock(),
            setActiveMessages: mock(),
            setAuthMode: mock(),
            handleSubmit: mock(),
            authMethod: 'December Cloud',
            hasBothAuth: true,
            getProviderModels: mock(async () => []),
        }

        const appReview = renderWithProviders(
            <ChatApp
                agent={mockAgent}
                isAuthenticated={true}
                cliVersion="0.3.9"
                userEmail="engineer@phasehumans.com"
                session={reviewSession}
            />
        )

        const frame = appReview.lastFrame() || ''
        expect(frame).toContain('Plan generated. Please approve, refine, or reject')
        expect(frame).toContain('[y] Approve & Execute')
        expect(frame).toContain('[r] Refine Plan')
        expect(frame).toContain('[v] View Full Plan')
        expect(frame).toContain('[n] Reject / Cancel')
        expect(frame).toContain('[PLAN]')
        appReview.unmount()
    })
})
