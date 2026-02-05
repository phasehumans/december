import { ReactNode } from 'react'

export interface NavItem {
  label: string
  icon: ReactNode
  href: string
  active?: boolean
}

export interface CanvasItem {
  id: string
  type: 'image' | 'file' | 'link' | 'shape' | 'note'
  content: string | ReactNode
  x: number
  y: number
  prompt?: string
  color?: string
}

export interface User {
  name: string
  email: string
  avatar: string
}
