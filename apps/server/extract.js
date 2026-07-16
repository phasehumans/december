const fs = require('fs')
const utilsPath = 'src/modules/auth/auth.utils.ts'
const usernamePath = 'src/shared/username.ts'

const lines = fs.readFileSync(utilsPath, 'utf8').split('\n')
const getUsernameLines = lines.slice(271, 2682)
fs.writeFileSync(usernamePath, getUsernameLines.join('\n'))

lines.splice(271, 2682 - 271)
fs.writeFileSync(utilsPath, lines.join('\n'))
