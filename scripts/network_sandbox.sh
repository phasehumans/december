#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <tap_interface>"
    exit 1
fi

TAP_IFACE=$1
RATE_LIMIT="100mbit"

echo "Applying network sandbox rules for $TAP_IFACE..."

# 1. IPTables Sandboxing (Phase 5.1)
# Drop traffic heading to local subnets (RFC 1918)
sudo iptables -I FORWARD -i $TAP_IFACE -d 10.0.0.0/8 -j DROP
sudo iptables -I FORWARD -i $TAP_IFACE -d 172.16.0.0/12 -j DROP
sudo iptables -I FORWARD -i $TAP_IFACE -d 192.168.0.0/16 -j DROP

# Drop traffic to cloud metadata service
sudo iptables -I FORWARD -i $TAP_IFACE -d 169.254.169.254 -j DROP

# Allow traffic to DNS servers (optional, usually handled elsewhere or via specific allows)
# We assume default policy allows forwarding to internet otherwise

# 2. Traffic Control Rate Limiting (Phase 5.2)
# Clear existing rules on the interface
sudo tc qdisc del dev $TAP_IFACE root 2>/dev/null || true

# Add root qdisc (Hierarchical Token Bucket)
sudo tc qdisc add dev $TAP_IFACE root handle 1: htb default 10

# Add class with max rate limit
sudo tc class add dev $TAP_IFACE parent 1: classid 1:1 htb rate $RATE_LIMIT ceil $RATE_LIMIT

# Add leaf qdisc (Fair Queueing Controlled Delay) for fairness
sudo tc qdisc add dev $TAP_IFACE parent 1:1 handle 10: fq_codel

echo "Sandbox rules applied successfully to $TAP_IFACE."
