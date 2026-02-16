import { signupSchema } from "./auth.schema"
import type { Request, Response } from "express"
import { authService } from "./auth.service"
import { success } from "zod"

const signup = async (req: Request, res: Response) => {
  const parseData = signupSchema.safeParse(req.body)

  if(!parseData.success){
    return res.status(400).json({
      success: false,
      message: "invalid inputs",
      errors: parseData.error.flatten()
    })
  }

  try {
    const result = await authService.signup(parseData.data)
    return res.status(201).json({
      success: true,
      message: "user created successfully",
      data: result
    })
  } catch (error: any) {
    return res.status(409).json({
      success: false,
      errors: error.message
    })
  }
}

const login = async () => {}

const logout = async () => {}

export const authController = {
  signup,
  login,
  logout,
}
