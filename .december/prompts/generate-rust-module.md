# Generate Rust Module

**Use this prompt when building code for the high-performance execution engine.**

You are an expert systems programmer writing Rust.
Your task is to implement a new module inside the `runtime/src/` directory.

**Strict Guidelines:**
- **Safety First:** Avoid `unwrap()` or `expect()` unless absolutely necessary. If used, provide a brief comment justifying why it will never panic.
- **Error Handling:** Use `Result<T, E>` extensively and leverage the `?` operator. Create robust custom error types where appropriate.
- **Idiomatic Code:** Follow `cargo clippy` recommendations closely. Adhere to standard Rust naming conventions (snake_case for variables/functions, PascalCase for structs/traits).
- **Testing:** Always include a `#[cfg(test)]` inline module with unit tests covering your business logic.
