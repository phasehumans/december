use crate::error::DecemberError;
use crate::memory::SessionMemory;

pub struct CodingAgent {
    memory: SessionMemory,
}

impl CodingAgent {
    pub fn new() -> Self {
        Self {
            memory: SessionMemory::default(),
        }
    }

    pub async fn respond(&mut self, prompt: &str) -> Result<String, DecemberError> {
        let cleaned = prompt.trim();
        if cleaned.is_empty() {
            return Err(DecemberError::EmptyPrompt);
        }

        self.memory.push_user(cleaned);
        let reply = self.generate_reply(cleaned);
        self.memory.push_assistant(reply.clone());
        Ok(reply)
    }

    pub fn history(&self, max_messages: usize) -> String {
        self.memory.transcript(max_messages)
    }

    fn generate_reply(&self, prompt: &str) -> String {
        let p = prompt.to_lowercase();
        if p.contains("init") && p.contains("rust") {
            return "Plan:\n1. Create a Cargo project scaffold.\n2. Add CLI argument parsing and command routing.\n3. Add agent/memory modules.\n4. Run `cargo fmt` and `cargo check`.".to_string();
        }

        if p.contains("fix") || p.contains("bug") {
            return "Plan:\n1. Reproduce the issue.\n2. Identify the failing code path.\n3. Patch with the smallest safe change.\n4. Run checks and summarize impact.".to_string();
        }

        format!(
            "I can help with that. First action: inspect the repository and current build status for: \"{}\"",
            prompt
        )
    }
}

