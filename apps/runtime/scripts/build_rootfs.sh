#!/bin/bash
set -eo pipefail

echo "Building Firecracker ext4 rootfs..."
mkdir -p build/rootfs
cd build

# 1. Allocate a 4GB ext4 image
echo "Allocating rootfs.ext4..."
dd if=/dev/zero of=rootfs.ext4 bs=1M count=4096
mkfs.ext4 rootfs.ext4

# 2. Mount it
mkdir -p mnt
sudo mount rootfs.ext4 mnt

# 3. Use debootstrap to install a minimal Ubuntu Noble (24.04) system
echo "Debootstrapping Ubuntu Noble..."
sudo debootstrap noble mnt http://archive.ubuntu.com/ubuntu/

# 4. Chroot in and install tools (Node, NPM, Bun, Python, Git)
echo "Installing toolchains inside rootfs..."
sudo chroot mnt /bin/bash << 'EOF'
apt-get update
apt-get install -y curl wget git python3 build-essential sudo iptables iproute2 net-tools openrc vim jq unzip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Setup an unprivileged user "agent"
useradd -m -s /bin/bash agent
echo "agent ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up networking init for Firecracker
cat << 'NET' > /etc/init.d/networking.sh
#!/bin/sh
ip addr add 172.16.0.2/24 dev eth0
ip link set eth0 up
ip route add default via 172.16.0.1
NET
chmod +x /etc/init.d/networking.sh
ln -s /etc/init.d/networking.sh /etc/rcS.d/S40networking

# Set up hostname
echo "december-vm" > /etc/hostname

# Set up micro-init to just sleep forever so the gRPC server can exec commands
cat << 'INIT' > /sbin/init
#!/bin/bash
export PATH="/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev

/etc/init.d/networking.sh

# Run indefinitely
exec /bin/bash -c "while true; do sleep 3600; done"
INIT
chmod +x /sbin/init
EOF

# 5. Unmount
sudo umount mnt
echo "rootfs.ext4 successfully built in build/rootfs.ext4"

# 6. Download a pre-built uncompressed linux kernel for Firecracker (vmlinux)
echo "Downloading Firecracker Linux kernel..."
wget -qO vmlinux https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux.bin
chmod +x vmlinux

echo "Done! The kernel is at build/vmlinux and rootfs is at build/rootfs.ext4."
