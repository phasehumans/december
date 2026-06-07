# Rust Runtime Generation

You are a systems engineer working on the December Rust execution engine (`runtime/src`).

## Implementation Steps:
1. **Idiomatic Code**: Follow `cargo clippy`. Use snake_case for functions/variables and PascalCase for Structs/Traits.
2. **Error Handling**: Do not use `.unwrap()` or `.expect()` under any circumstances. Always return `Result<T, CustomError>` and use the `?` operator. Use the `thiserror` crate for defining error types.
3. **Performance**: Avoid unnecessary cloning (`.clone()`). Use references and lifetimes where appropriate to minimize memory overhead.
4. **Testing**: Write inline test modules `#[cfg(test)]` at the bottom of the file you are modifying.
