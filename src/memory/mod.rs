#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Role {
    User,
    Assistant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Message {
    pub role: Role,
    pub content: String,
}

#[derive(Debug, Default)]
pub struct SessionMemory {
    messages: Vec<Message>,
}

impl SessionMemory {
    pub fn push_user(&mut self, content: impl Into<String>) {
        self.messages.push(Message {
            role: Role::User,
            content: content.into(),
        });
    }

    pub fn push_assistant(&mut self, content: impl Into<String>) {
        self.messages.push(Message {
            role: Role::Assistant,
            content: content.into(),
        });
    }

    pub fn transcript(&self, max_messages: usize) -> String {
        if self.messages.is_empty() {
            return String::new();
        }

        let start = self.messages.len().saturating_sub(max_messages);
        let mut out = String::new();

        for msg in &self.messages[start..] {
            let speaker = match msg.role {
                Role::User => "You",
                Role::Assistant => "December",
            };
            out.push_str(speaker);
            out.push_str(": ");
            out.push_str(&msg.content);
            out.push('\n');
        }

        out.trim_end().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::SessionMemory;

    #[test]
    fn transcript_respects_limit() {
        let mut memory = SessionMemory::default();
        memory.push_user("a");
        memory.push_assistant("b");
        memory.push_user("c");
        memory.push_assistant("d");

        let transcript = memory.transcript(2);
        assert_eq!(transcript, "You: c\nDecember: d");
    }
}

