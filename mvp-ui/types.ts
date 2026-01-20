import { ReactNode } from "react";

export interface NavItem {
  label: string;
  icon: ReactNode;
  href: string;
  active?: boolean;
}

export interface CanvasItem {
  id: string;
  type: 'image' | 'file' | 'link' | 'shape';
  content: string | ReactNode;
  x: number;
  y: number;
  prompt?: string;
}

export interface User {
  name: string;
  email: string;
  avatar: string;
}
