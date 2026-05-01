export const extractFirstName = (fullname: string) => {
    return fullname.trim().split(/\s+/)[0] || 'Profile'
}
