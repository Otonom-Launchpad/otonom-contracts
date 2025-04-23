#!/bin/bash
# Robust testing script for Solana devnet testing
# Perfect for hackathon submissions when judges need to verify your work

set -e  # Exit on any error

echo "===== Otonom Fund Devnet Testing ====="
echo "This script tests the contract against Solana devnet"
echo "Ideal for hackathon submissions and cross-platform compatibility"

# Ensure we're on devnet
solana config set --url devnet

# Build the latest contract version
echo "Building contract..."
anchor build

# Check if we have enough SOL for testing
BALANCE=$(solana balance | cut -d " " -f1)
REQUIRED_SOL=3.0
BALANCE_FLOAT=$(echo $BALANCE | sed 's/[^0-9.]//g')

if (( $(echo "$BALANCE_FLOAT < $REQUIRED_SOL" | bc -l) )); then
  echo "Warning: Low SOL balance on devnet: $BALANCE SOL"
  echo "For full deployment testing, you need at least $REQUIRED_SOL SOL"
  echo "Get more SOL from https://solfaucet.com/"
  
  read -p "Continue with limited testing? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
  
  # Run just the tests without deployment
  echo "Running tests without deployment..."
  anchor test --skip-local-validator --skip-deploy
else
  # We have enough SOL for full testing
  echo "SOL balance sufficient for testing: $BALANCE SOL"
  echo "Running full tests with deployment..."
  anchor test --skip-local-validator
fi

echo "===== Testing completed ====="
