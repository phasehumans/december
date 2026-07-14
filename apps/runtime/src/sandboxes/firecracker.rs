use std::process::Command;
use std::path::PathBuf;
use tracing::{info, error};
use std::fs;

#[derive(Clone, Debug)]
pub struct FirecrackerSandbox {
    pub vm_id: String,
    pub base_rootfs: PathBuf,
    pub kernel_path: PathBuf,
}

impl FirecrackerSandbox {
    pub fn new(vm_id: String, base_rootfs: PathBuf, kernel_path: PathBuf) -> Self {
        Self {
            vm_id,
            base_rootfs,
            kernel_path,
        }
    }

    /// Creates a Copy-On-Write snapshot of the base rootfs using sparse file + dmsetup or simply cp --sparse
    pub async fn create_snapshot(&self) -> Result<PathBuf, String> {
        let snapshot_path = PathBuf::from(format!("/tmp/fc-vm-{}.ext4", self.vm_id));
        
        // Simplest fast copy on modern filesystems (btrfs/xfs/ext4 with reflink/sparse)
        // For production, dm-thin provisioning or LVM is better.
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

    /// Sets up the TAP network device for the VM and configures IP tables
    pub async fn setup_network(&self) -> Result<String, String> {
        let tap_name = format!("tap-{}", &self.vm_id[..std::cmp::min(self.vm_id.len(), 11)]);
        
        // Create TAP interface
        Command::new("ip").args(&["tuntap", "add", "dev", &tap_name, "mode", "tap"]).status().map_err(|e| e.to_string())?;
        Command::new("ip").args(&["link", "set", "dev", &tap_name, "up"]).status().map_err(|e| e.to_string())?;
        
        // In a real system, you'd add this TAP to a bridge or set an IP and enable MASQUERADE
        // Command::new("ip").args(&["addr", "add", "172.16.0.1/24", "dev", &tap_name]).status().map_err(|e| e.to_string())?;
        // Command::new("iptables").args(&["-t", "nat", "-A", "POSTROUTING", "-o", "eth0", "-j", "MASQUERADE"]).status().map_err(|e| e.to_string())?;

        Ok(tap_name)
    }

    /// Downloads and extracts the workspace handoff from MinIO
    pub async fn restore_workspace(&self, rootfs_path: &PathBuf, presigned_url: &str) -> Result<(), String> {
        info!("Restoring workspace into VM rootfs from MinIO url...");
        
        // We'd mount the rootfs locally to inject the files before booting
        let mnt_dir = format!("/tmp/mnt-{}", self.vm_id);
        fs::create_dir_all(&mnt_dir).unwrap();
        
        Command::new("sudo").args(&["mount", "-o", "loop", rootfs_path.to_str().unwrap(), &mnt_dir]).status().unwrap();
        
        // Download zip inside the mount
        let zip_path = format!("{}/workspace.tar.gz", mnt_dir);
        let status = Command::new("curl")
            .args(&["-sSL", "-o", &zip_path, presigned_url])
            .status()
            .map_err(|e| e.to_string())?;
            
        if status.success() {
            // Extract
            Command::new("tar").args(&["-xzf", &zip_path, "-C", &mnt_dir]).status().unwrap();
            fs::remove_file(zip_path).unwrap();
        }

        Command::new("sudo").args(&["umount", &mnt_dir]).status().unwrap();
        fs::remove_dir(&mnt_dir).unwrap();

        Ok(())
    }

    pub async fn start(&self, rootfs_path: &PathBuf, tap_name: &str) -> Result<(), String> {
        let sock_path = format!("/tmp/fc-{}.sock", self.vm_id);
        if PathBuf::from(&sock_path).exists() {
            fs::remove_file(&sock_path).unwrap();
        }

        // Generate firecracker config
        let config = format!(r#"{{
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
            "machine-config": {{
                "vcpu_count": 2,
                "mem_size_mib": 2048,
                "smt": false
            }}
        }}"#, self.kernel_path.display(), rootfs_path.display(), tap_name);

        let cfg_path = format!("/tmp/fc-{}.json", self.vm_id);
        fs::write(&cfg_path, config).unwrap();

        // Spawn firecracker process
        info!("Spawning Firecracker process for {}", self.vm_id);
        Command::new("firecracker")
            .args(&["--api-sock", &sock_path, "--config-file", &cfg_path])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn destroy(&self) -> Result<(), String> {
        info!("Destroying VM {}", self.vm_id);
        let tap_name = format!("tap-{}", &self.vm_id[..std::cmp::min(self.vm_id.len(), 11)]);
        Command::new("ip").args(&["link", "del", "dev", &tap_name]).status().ok();
        
        let rootfs_path = format!("/tmp/fc-vm-{}.ext4", self.vm_id);
        fs::remove_file(rootfs_path).ok();
        
        let sock_path = format!("/tmp/fc-{}.sock", self.vm_id);
        fs::remove_file(sock_path).ok();
        let cfg_path = format!("/tmp/fc-{}.json", self.vm_id);
        fs::remove_file(cfg_path).ok();

        // Kill firecracker process (we'd track PID in reality)
        Command::new("pkill").args(&["-f", &format!("fc-{}.json", self.vm_id)]).status().ok();

        Ok(())
    }

    pub async fn execute_command(&self, command: &str) -> Result<String, String> {
        // Execute inside Firecracker using an ssh key or an agent running inside.
        // For now, we simulate execution.
        Ok(format!("Simulated output for: {}\n", command))
    }
}
