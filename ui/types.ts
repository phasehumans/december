import { ReactNode } from "react";

export interface NavItem {
  label: string;
  icon: ReactNode;
  href: string;
  active?: boolean;
}

export interface CanvasItem {
  id: string;
  type: 'image' | 'link' | 'note' | 'square' | 'circle' | 'frame' | 'line' | 'arrow';
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  prompt?: string;
}