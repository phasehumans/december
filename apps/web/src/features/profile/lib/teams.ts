// team accounts are off: december is for one person today. the members page, its row in
// settings and the invite page stay in the code and are not reachable. the server routes
// are off too (TEAMS_ENABLED). see issue 640

let teamsOverride: boolean | null = null

/** for tests */
export const setTeamsEnabled = (enabled: boolean | null) => {
    teamsOverride = enabled
}

export const isTeamsEnabled = (): boolean => teamsOverride ?? false
