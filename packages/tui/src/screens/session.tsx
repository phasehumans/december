import { SessionShell } from '../components/session-shell'

type Props = {
    onSubmit: (text: string) => void
}

export function Session({ onSubmit }: Props) {
    return <SessionShell onSubmit={onSubmit} inputDisabled loading />
}
