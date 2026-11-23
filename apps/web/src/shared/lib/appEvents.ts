/**
 * Window events that let one part of the app ask another part to do something,
 * without passing callbacks through every screen.
 */

/** opens the search modal (the /resume command) */
export const OPEN_SEARCH_EVENT = 'december:open-search'

/** starts a new session, the same as "New" in the sidebar (the /new command) */
export const NEW_SESSION_REQUEST_EVENT = 'december:request-new-session'

/** starts or stops the microphone of the prompt box (the /voice command) */
export const TOGGLE_VOICE_EVENT = 'december:toggle-voice'
