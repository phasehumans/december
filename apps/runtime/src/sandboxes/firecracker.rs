use std::process::Command;
use std::path::PathBuf;
use tracing::{info, error};
use std::fs;
use crate::config::RuntimeConfig;

#[derive(Clone, Debug)]
pub struct FirecrackerSandbox {
    pub vm_id: String,
    pub base_rootfs: PathBuf,
    pub kernel_path: PathBuf,
    pub config: RuntimeConfig,
}

impl FirecrackerSandbox {
    pub fn new(vm_id: String, base_rootfs: PathBuf, kernel_path: PathBuf) -> Self {
        Self {
            vm_id,
            base_rootfs,
            kernel_path,
            config: RuntimeConfig::from_env(),
        }
    }

    pub async fn create_snapshot(&self) -> Result<PathBuf, String> {
        let snapshot_path = PathBuf::from(format!("/tmp/fc-vm-{}.ext4", self.vm_id));
        let status = Command::new("cp")
            .arg("--sparse=always")
            .arg(&self.base_rootfs)
            .arg(&snapshot_path)
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to create rootfs snapshot".to_string());
        }

        Ok(snapshot_path)
    }

    pub async fn setup_network(&self) -> Result<String, String> {
        let tap_name = format!("{}{}", self.config.tap_prefix, &self.vm_id[..std::cmp::min(self.vm_id.len(), 11)]);
        
        Command::new("sudo").args(&["ip", "tuntap", "add", "dev", &tap_name, "mode", "tap"]).status().map_err(|e| e.to_string())?;
        Command::new("sudo").args(&["ip", "link", "set", "dev", &tap_name, "up"]).status().map_err(|e| e.to_string())?;
        
        // Map IP based on VM ID or a pool in a real app, here we use a static one for demo
        Command::new("sudo").args(&["ip", "addr", "add", "172.16.0.1/24", "dev", &tap_name]).status().map_err(|e| e.to_string())?;
        
        // Subnet Traffic Isolation (P4.T1)
        let subnets = ["10.0.0.0/8", "192.168.0.0/16"];
        for subnet in subnets {
            Command::new("sudo").args(&["iptables", "-I", "FORWARD", "1", "-i", &tap_name, "-d", subnet, "-j", "DROP"]).status().ok();
        }
        Command::new("sudo").args(&["iptables", "-I", "FORWARD", "1", "-i", &tap_name, "-d", "172.16.0.0/12", "!", "-d", "172.16.0.0/24", "-j", "DROP"]).status().ok();

        // VM Network Bandwidth Limiting (P4.T2)
        Command::new("sudo").args(&["tc", "qdisc", "add", "dev", &tap_name, "root", "tbf", "rate", "100mbit", "burst", "32kbit", "latency", "400ms"]).status().ok();

        // Implement NAT rule to provide internet egress to guest VMs
        Command::new("sudo")
            .args(&["iptables", "-t", "nat", "-A", "POSTROUTING", "-o", &self.config.egress_iface, "-j", "MASQUERADE"])
            .status()
            .map_err(|e| e.to_string())?;

        Ok(tap_name)
    }

    pub async fn restore_workspace(&self, rootfs_path: &PathBuf, presigned_url: &str) -> Result<(), String> {
        info!("Restoring workspace into VM rootfs from MinIO url...");
        
        let mnt_dir = format!("/tmp/mnt-{}", self.vm_id);
        fs::create_dir_all(&mnt_dir).unwrap();
        
        Command::new("sudo").args(&["mount", "-o", "loop", rootfs_path.to_str().unwrap(), &mnt_dir]).status().unwrap();
        
        let zip_path = format!("{}/workspace.tar.gz", mnt_dir);
        if !presigned_url.is_empty() {
            let status = Command::new("curl")
                .args(&["-sSL", "-o", &zip_path, presigned_url])
                .status()
                .map_err(|e| e.to_string())?;
                
            if status.success() {
                Command::new("sudo").args(&["tar", "-xzf", &zip_path, "-C", &mnt_dir]).status().unwrap();
                Command::new("sudo").args(&["rm", &zip_path]).status().unwrap();
            }
        }

        // Copy sidecar and agent binaries
        let target_bin = format!("{}/usr/local/bin/", mnt_dir);
        Command::new("sudo").args(&["cp", &self.config.sidecar_binary_path, &target_bin]).status().ok();
        Command::new("sudo").args(&["cp", &self.config.agent_binary_path, &target_bin]).status().ok();

        Command::new("sudo").args(&["umount", &mnt_dir]).status().unwrap();
        fs::remove_dir(&mnt_dir).unwrap();

        Ok(())
    }

    pub async fn start(&self, rootfs_path: &PathBuf, tap_name: &str) -> Result<(), String> {
        let sock_path = format!("/tmp/fc-{}.sock", self.vm_id);
        if PathBuf::from(&sock_path).exists() {
            fs::remove_file(&sock_path).unwrap();
        }

        let vsock_path = format!("/tmp/fc-{}.vsock", self.vm_id);
        if PathBuf::from(&vsock_path).exists() {
            fs::remove_file(&vsock_path).unwrap();
        }

        let config_json = format!(r#"{{
            "boot-source": {{
                "kernel_image_path": "{}",
                "boot_args": "console=ttyS0 reboot=k panic=1 pci=off quiet"
            }},
            "drives": [
                {{
                    "drive_id": "rootfs",
                    "path_on_host": "{}",
                    "is_root_device": true,
                    "is_read_only": false
                }}
            ],
            "network-interfaces": [
                {{
                    "iface_id": "net1",
                    "guest_mac": "06:00:AC:10:00:02",
                    "host_dev_name": "{}"
                }}
            ],
            "vsock": {{
                "guest_cid": 3,
                "uds_path": "{}"
            }},
            "machine-config": {{
                "vcpu_count": {},
                "mem_size_mib": {},
                "smt": false
            }}
        }}"#, self.kernel_path.display(), rootfs_path.display(), tap_name, vsock_path, self.config.vcpu_count, self.config.memory_mib);

        let cfg_path = format!("/tmp/fc-{}.json", self.vm_id);
        fs::write(&cfg_path, config_json).unwrap();

        info!("Spawning Firecracker process for {}", self.vm_id);
        Command::new("/home/chaitanya/code/december/firecracker")
            .args(&["--api-sock", &sock_path, "--config-file", &cfg_path])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn destroy(&self) -> Result<(), String> {
        info!("Destroying VM {}", self.vm_id);
        let tap_name = format!("{}{}", self.config.tap_prefix, &self.vm_id[..std::cmp::min(self.vm_id.len(), 11)]);
        Command::new("sudo").args(&["ip", "link", "del", "dev", &tap_name]).status().ok();
        
        let rootfs_path = format!("/tmp/fc-vm-{}.ext4", self.vm_id);
        fs::remove_file(rootfs_path).ok();
        
        let sock_path = format!("/tmp/fc-{}.sock", self.vm_id);
        fs::remove_file(sock_path).ok();
        let vsock_path = format!("/tmp/fc-{}.vsock", self.vm_id);
        fs::remove_file(vsock_path).ok();
        let cfg_path = format!("/tmp/fc-{}.json", self.vm_id);
        fs::remove_file(cfg_path).ok();

        Command::new("pkill").args(&["-f", &format!("fc-{}.json", self.vm_id)]).status().ok();

        Ok(())
    }

    pub async fn execute_command(&self, command: &str) -> Result<String, String> {
        Ok(format!("Simulated output for: {}\n", command))
    }
}
