use thiserror::Error;

#[derive(Debug, Error)]
pub enum DecemberError {
    #[error("Prompt cannot be empty")]
    EmptyPrompt,
}

