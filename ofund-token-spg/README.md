# Otonom Fund - SPG Deployed Version

This is the simplified version of the contract deployed via Solana Playground (SPG).

## Deployment Details

- Program ID: EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN
- Mint Address: 4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY
- Network: Solana Devnet
- Admin Wallet: ZUPUit9Pfsc9vWz72n83mRH9h32JzBQksq2b6Grnv8W

## Key Features

- Initialize existing mint authority using specialized instruction
- Register users and airdrop tokens
- Record on-chain investments

## Initialization

See the `scripts/initialize-existing-mint.js` script for the initialization process. 

You can run the initialization using:
```bash
npm run deploy  # Runs the initialize-existing-mint.js script
```

## Script Commands

This package includes several npm scripts for interaction with the deployed contract:

```bash
npm run deploy     # Initialize existing mint authority
npm run init-mint  # Initialize mint authority using Anchor
npm run create-mint # Create a new mint (if needed)
npm run init-spg   # Initialize using SPG-specific script
```
