# Otonom Fund - Local Development Contract

This directory contains the complete Anchor project for local development and testing of the Otonom Fund smart contract. While the SPG version is deployed for production use on Solana devnet, this full Anchor project allows for continued development, testing, and future enhancements.

## Directory Structure

```
ofund-token-local/
├── programs/               # Solana program code
│   └── ofund-token/        # Main contract code 
│       └── src/lib.rs      # Contract implementation
├── tests/                  # Integration tests
├── scripts/                # Deployment and utility scripts
├── migrations/             # Deployment migrations
├── app/                    # Application code
├── Anchor.toml             # Anchor configuration
├── Cargo.toml              # Rust dependencies
└── [other Anchor files]    # Standard Anchor project files
```

## Development Environment

### Prerequisites
- Solana CLI (v1.18+)
- Anchor Framework 
- Node.js (v18+)
- Rust (v1.75+)

### Setup and Build
```bash
# Install dependencies
npm install

# Build the contract
anchor build

# Run tests
anchor test
```

### Local Testing
See the [TESTING.md](./TESTING.md) document for detailed information about our testing strategy and procedures.

### Deployment
```bash
# Deploy to localnet
anchor deploy

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Scripts

The `scripts` directory contains utility scripts for contract initialization and testing:
- `init-mint-authority.js` - Initialize the mint authority for local testing
- `initialize-mint-authority.ts` - TypeScript version of the initialization script
- `test-devnet.sh` - Test script for devnet deployment

## Differences from SPG Version

This local development version includes:
1. Full Anchor project structure with tests
2. Complete development environment
3. More extensive error handling and testing capabilities

The deployed SPG version (in `../ofund-token-spg/`) contains the simplified production code actually running on Solana devnet at program ID `EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN`.
