/**
 * Events about the own account of a user: the sign-in ip, the names of secrets and keys,
 * the amounts of top-ups. Only the user who did them reads them, not the other admins of
 * the team. Member events stay visible to the owner and the admins.
 */
export const PERSONAL_ACTION_PREFIXES = ['auth.', 'secret.', 'key.', 'billing.'] as const

export const isPersonalAuditAction = (action: string): boolean =>
    PERSONAL_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix))
