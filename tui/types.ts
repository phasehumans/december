export enum Role {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export enum Mode {
  BUILD = 'build',
  PLAN = 'plan'
}

export interface Command {
  id: string;
  label: string;
  shortcut: string;
}