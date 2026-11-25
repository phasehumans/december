/** the low balance alert amount of a new user ($1). each user can change it or turn it off (#638) */
export const LOW_CREDITS_ALERT_CENTS = 100

/**
 * The one rule for the low credits alert, for every place that charges credits (the worker's
 * run charge and the server's own charges). True when this charge took the balance under the
 * amount: it was at or over the amount before the charge, and it is under it now. So one drop
 * gives one alert. Later charges under the amount are false, until a top-up takes the balance
 * back over.
 */
export function crossedLowCreditsAmount(data: {
    balanceBefore: number
    balanceAfter: number
    /** the user's amount. null: the alert is off. not given: the amount of a new user */
    alertCents?: number | null
}): boolean {
    const { balanceBefore, balanceAfter, alertCents = LOW_CREDITS_ALERT_CENTS } = data
    if (alertCents === null) return false
    return balanceBefore >= alertCents && balanceAfter < alertCents
}
