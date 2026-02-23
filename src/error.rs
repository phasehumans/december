use thiserror::Error;

#[derive(Error, Debug)]
pub enum DecemberError {
    #[error("Invalid input")]
    InvalidInput,
}