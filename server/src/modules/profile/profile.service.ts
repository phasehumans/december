import { email } from 'zod'
import { prisma } from '../../utils/db'

type getProfileType = {
  userId: string
}

type updateNameType = {
  userId: string
  name: string
}

type changePasswordType = {
  userId: string
  password: string
}

const getProfile = async (data: getProfileType) => {
  const profile = await prisma.user.findUnique({
    where: {
      id: data.userId,
    },
  })

  if (!profile) {
    throw new Error('user doesnot exist')
  }

  return {
    name: profile.name,
    email: profile.email,
  }
}

const updateName = async (data: updateNameType) => {}

const changePassword = async (data: changePasswordType) => {}

export const profileService = {
  getProfile,
  updateName,
  changePassword,
}
