#!/bin/bash
set -e

# Creates a 10GB ext4 Ubuntu rootfs image for Firecracker
IMAGE_SIZE="10G"
IMAGE_FILE="ubuntu-rootfs.ext4"

echo "Building Firecracker Ubuntu Rootfs Image ($IMAGE_SIZE)..."

# Step 1: Create an empty file and format it as ext4
rm -f $IMAGE_FILE ubuntu-base.tar
dd if=/dev/zero of=$IMAGE_FILE bs=1M count=0 seek=10240
mkfs.ext4 -F $IMAGE_FILE

# Step 2: Use Docker to create an Ubuntu container with necessary tools
TMP_CONTAINER="ubuntu-fc-base"
docker rm -f $TMP_CONTAINER || true
docker run -d --name $TMP_CONTAINER ubuntu:24.04 sleep 3600

# Install basic dev tools inside the container
docker exec $TMP_CONTAINER apt-get update
docker exec $TMP_CONTAINER apt-get install -y curl wget git python3 python3-pip nodejs npm build-essential sudo init systemd

# Export container filesystem to a tar archive
docker export $TMP_CONTAINER -o ubuntu-base.tar
docker rm -f $TMP_CONTAINER

# Step 3: Mount the ext4 image and extract the filesystem
mkdir -p /tmp/fc-mount
sudo mount -o loop $IMAGE_FILE /tmp/fc-mount
sudo tar -xf ubuntu-base.tar -C /tmp/fc-mount/

# Bake December Sidecar Daemon
echo "Compiling and baking sidecar daemon..."
# Assume script is run from project root
cargo build --release --manifest-path apps/sidecar/Cargo.toml
sudo cp apps/sidecar/target/release/sidecar /tmp/fc-mount/usr/local/bin/december-sidecar
sudo chmod +x /tmp/fc-mount/usr/local/bin/december-sidecar

echo "Compiling and baking December TS agent..."
bun run --cwd apps/sidecar build:agent
sudo cp apps/sidecar/december-agent /tmp/fc-mount/usr/local/bin/december-agent
sudo chmod +x /tmp/fc-mount/usr/local/bin/december-agent

# Add systemd service for sidecar
cat << 'EOF' | sudo tee /tmp/fc-mount/etc/systemd/system/december-sidecar.service
[Unit]
Description=December Vsock Sidecar
After=network.target

[Service]
ExecStart=/usr/local/bin/december-sidecar
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo chroot /tmp/fc-mount systemctl enable december-sidecar.service

# Step 4: Cleanup and unmount
echo "Cleaning up..."
sudo umount /tmp/fc-mount
rm -rf /tmp/fc-mount
rm ubuntu-base.tar

echo "Done! The rootfs image is located at $IMAGE_FILE"
