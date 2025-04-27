# Otonom Fund Smart Contracts

This repository contains the Solana smart contracts for the Otonom Fund Launchpad platform. The contracts handle token management, user registration, and investment tracking on the Solana blockchain.

## Repository Structure

The repository is organized into two main contract versions:

```
otonom-contracts/
├── ofund-token-spg/     # Production contract deployed via Solana Playground
│   ├── lib.rs           # Contract code deployed on Solana devnet
│   ├── ofund-idl.json   # Interface Definition Language for the contract
│   ├── scripts/         # Deployment and initialization scripts
│   └── README.md        # Documentation for the SPG version
│
└── ofund-token-local/   # Local development version with complete Anchor project structure
    ├── programs/        # Contract code and implementation
    ├── tests/           # Contract test suite
    ├── scripts/         # Deployment and initialization scripts
    └── [Anchor files]   # Standard Anchor project configuration
```

## Deployed Contract Information

- **Program ID**: `EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN`
- **OFUND Token Mint**: `4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY`
- **Network**: Solana Devnet
- **Deployment Method**: Solana Playground (SPG)

## Key Features

- **User Registration**: Automatic PDA creation for new users
- **Initial Token Allocation**: Grants 100,000 OFUND tokens to new users
- **Investment Tracking**: Records user investments on-chain
- **Admin Controls**: Secure admin-only initialization functions

## Development Setup

### Prerequisites
- Solana CLI (v1.18+)
- Anchor Framework
- Node.js (v18+)
- Rust (v1.75+)

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd otonom-contracts/ofund-token-local

# Install dependencies
npm install

# Build the contract
anchor build

# Test the contract
anchor test

# Deploy to devnet (optional)
anchor deploy --provider.cluster devnet
```

### Using the SPG Deployed Version

```bash
# Navigate to the SPG version directory
cd ofund-token-spg

# Install dependencies
npm install

# Initialize mint authority (if needed)
npm run init-spg
```

## Verification

All transactions performed by these contracts can be verified on the [Solana Explorer](https://explorer.solana.com/?cluster=devnet) by searching for the Program ID or transaction signatures.