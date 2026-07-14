fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .compile_protos(&["../../packages/proto/runtime.proto"], &["../../packages/proto"])?;
    Ok(())
}
