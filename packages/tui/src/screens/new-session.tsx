import { UserMessage, BotMessage, ErrorMessage } from '../components/messages'
import { SessionShell } from '../components/session-shell'

type Props = {
    initialMessage: string
    onSubmit: (text: string) => void
}

export function NewSession({ initialMessage, onSubmit }: Props) {
    return (
        <SessionShell onSubmit={onSubmit} inputDisabled loading>
            <UserMessage message={initialMessage} />
            <BotMessage
                content="This is a sample bot response to demonstrate the message layout."
                model="opus-4-6"
            />
            <ErrorMessage message="This is a sample error message." />
        </SessionShell>
    )
}
