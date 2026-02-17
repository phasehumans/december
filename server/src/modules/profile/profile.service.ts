import { email } from 'zod'
import { prisma } from '../../utils/db'
import bcrypt from 'bcrypt'

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

const updateName = async (data: updateNameType) => {
  const { name, userId } = data

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!existingUser) {
    throw new Error('user does not exist')
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: name,
    },
  })

  return {
    name: updatedUser.name,
  }
}

const changePassword = async (data: changePasswordType) => {
  const { password, userId } = data

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!existingUser) {
    throw new Error('user does not exist')
  }

  const hashPassword = await bcrypt.hash(password, 10)

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      password: hashPassword,
    },
  })

  return {
    name: updatedUser.name,
  }
}

export const profileService = {
  getProfile,
  updateName,
  changePassword,
}
