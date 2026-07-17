use std::env;

#[derive(Clone, Debug)]
pub struct RuntimeConfig {
    pub subnet: String,
    pub tap_prefix: String,
    pub memory_mib: usize,
    pub vcpu_count: usize,
    pub egress_iface: String,
    pub sidecar_binary_path: String,
    pub agent_binary_path: String,
}

impl RuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            subnet: env::var("VM_SUBNET").unwrap_or_else(|_| "172.16.0.0/24".to_string()),
            tap_prefix: env::var("TAP_PREFIX").unwrap_or_else(|_| "tap-".to_string()),
            memory_mib: env::var("VM_MEMORY_MIB").unwrap_or_else(|_| "2048".to_string()).parse().unwrap_or(2048),
            vcpu_count: env::var("VM_VCPU_COUNT").unwrap_or_else(|_| "2".to_string()).parse().unwrap_or(2),
            egress_iface: env::var("EGRESS_IFACE").unwrap_or_else(|_| "eth0".to_string()),
            sidecar_binary_path: env::var("SIDECAR_BINARY_PATH").unwrap_or_else(|_| "/home/chaitanya/code/december/apps/sidecar/target/release/december-sidecar".to_string()),
            agent_binary_path: env::var("AGENT_BINARY_PATH").unwrap_or_else(|_| "/home/chaitanya/code/december/apps/sidecar/december-agent".to_string()),
        }
    }
}
