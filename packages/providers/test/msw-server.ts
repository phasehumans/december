import { setupServer } from 'msw/node'

import { handlers } from './msw-handlers'

export const mswServer = setupServer(...handlers)
