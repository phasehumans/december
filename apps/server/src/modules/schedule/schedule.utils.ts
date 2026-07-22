export function isValidCron(cron: string): boolean {
    return cron.split(' ').length >= 5
}
