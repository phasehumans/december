#!/bin/bash

# Clear script to clean storage, workspaces, and import staging folders

echo "Cleaning up temporary directories..."

# 1. Clean MinIO december-storage data
if [ -d "infra/minio/data/december-storage" ]; then
    echo "Clearing infra/minio/data/december-storage/*"
    rm -rf infra/minio/data/december-storage/*
else
    echo "Directory infra/minio/data/december-storage not found."
fi

# 2. Clean runtime workspaces data
if [ -d "runtime/data/workspaces" ]; then
    echo "Clearing runtime/data/workspaces/*"
    rm -rf runtime/data/workspaces/*
else
    echo "Directory runtime/data/workspaces not found."
fi

# 3. Clean server imports data
if [ -d "apps/server/.december-imports" ]; then
    echo "Clearing apps/server/.december-imports/*"
    rm -rf apps/server/.december-imports/*
elif [ -d ".december-imports" ]; then
    echo "Clearing .december-imports/*"
    rm -rf .december-imports/*
else
    echo "Directory apps/server/.december-imports not found."
fi

echo "Cleanup completed successfully!"
