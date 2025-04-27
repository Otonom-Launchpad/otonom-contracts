# Otonom Fund Contract Testing Documentation

## Overview

This document outlines the comprehensive testing strategy for the Otonom Fund launchpad smart contracts. Our contracts implement a non-discriminatory investment platform on Solana that has removed tier-based restrictions to create an inclusive environment for all investors.

## Testing Environments

### Local Testing (Development)
- Unit tests within the Rust code
- Integration tests using Anchor's TypeScript framework
- Note: macOS users may encounter issues with Solana's test validator due to hidden file generation ("._genesis.bin")

### Devnet Testing (Staging)
- Full contract deployment to Solana Devnet
- Integration with frontend components
- Testing with real Solana wallets (Phantom)

### Mainnet Testing (Production - Future)
- Final deployment with comprehensive security audits
- Limited beta testing with controlled token distribution

## Key Test Cases

### 1. User Registration Flow
- User connects wallet
- System checks if profile exists
- If not, system automatically creates profile
- Initial 100,000 OFUND tokens are granted
- User tier is calculated based on token balance

### 2. Project Creation
- Admin can create new projects
- Projects are initialized without tier restrictions
- All users can view and invest in any project regardless of tier

### 3. Investment Functionality
- Users with any token balance can invest in projects
- Investment amounts are properly recorded
- Multiple investments per user per project are tracked

### 4. Access Control
- Only admin can create projects
- Only admin can mint tokens
- Users can only invest their own tokens

## Non-Discriminatory Design Verification

Our testing specifically verifies that:

1. The `minTierRequired` parameter has been removed from project initialization
2. Users with minimal token balances (even below Tier 1 threshold) can successfully invest in projects
3. No functions check tier level before allowing investments

## Testing Commands

```bash
# Build the contract
anchor build

# Run tests against a local validator (Linux/Windows)
anchor test

# Run tests against Devnet (recommended for cross-platform compatibility)
solana config set --url devnet
anchor test --skip-local-validator

# Deploy to devnet for full integration testing
anchor build
anchor deploy
```

## Known Platform-Specific Issues

When testing on macOS systems, developers might encounter issues with the Solana test validator due to hidden ".DS_Store" and "._" files that macOS creates. These can be addressed by:

1. Running tests on devnet instead of local validator
2. Cleaning test-ledger directory before testing: `rm -rf test-ledger ~/.config/solana/test-ledger`
3. Using our macOS-specific testing script: `./scripts/test-mac.sh`

## CI/CD Integration (Proposed)

For production deployment, we recommend implementing CI/CD with:
- Automated testing on GitHub Actions (using Linux containers)
- Security scanning using Soteria or similar Solana auditing tools
- Automated deployment to devnet for staging verification
