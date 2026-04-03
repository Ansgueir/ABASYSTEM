#!/bin/bash
set -e
cd /opt/aba-system
echo "CLEANING UP..."
rm -rf .next
echo "BUILDING..."
# Ensure permissions are correct
chown -R aba_runner:aba_runner .
# We must run build as the user who owns the files
sudo -u aba_runner npm run build
echo "RESTARTING..."
systemctl restart aba-system
echo "DONE ✓"
