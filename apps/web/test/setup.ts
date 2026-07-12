import { expect, afterEach } from 'bun:test'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'

// Setup DOM environment handled in env.ts

// Add jest-dom matchers to bun:test
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
    cleanup()
})
