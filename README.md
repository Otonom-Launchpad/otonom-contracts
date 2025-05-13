# Otonom Fund Smart Contracts

This repository contains the Solana smart contracts for the Otonom Fund Launchpad platform. The contracts handle token management, user registration, and investment tracking on the Solana blockchain.

**For a comprehensive overview of the Otonom Fund project, including its architecture, overall setup guides, and other documentation, please refer to the main [Otonom Fund Documentation Hub](https://github.com/Otonom-Launchpad/otonom-docs/blob/main/README.md).**

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

- **Program ID**: `CWYLQDPfH6eywYGJfrSdX2cVMczm88x3V2Rd4tcgk4jf`
- **OFUND Token Mint**: `4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY` (Note: This mint address is for reference from initial contract tests; the frontend may use a different process for token association or minting upon user profile creation).
- **Network**: Solana Devnet
- **Deployment Method**: The source code for this program (located in `ofund-token-spg/`) was refined using Solana Playground. For integration into the broader project, the compiled artifact (`otonom-program.so`) is managed and deployed as described in the 'Building and Deploying the Main Program' section below.

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

### Local Development (`ofund-token-local/`)

This directory contains an earlier, standard Anchor project setup, useful for isolated local development and understanding Anchor fundamentals.

```bash
# Clone the repository (if not already done)
# git clone https://github.com/Otonom-Launchpad/otonom-contracts.git
cd otonom-contracts/ofund-token-local

# Install dependencies
npm install

# Build the contract
anchor build

# Test the contract
anchor test

# Deploy to devnet (optional, this will deploy to a *new* program ID based on your local keypairs)
anchor deploy --provider.cluster devnet
```

### Building and Deploying the Main Program (`ofund-token-spg/` - Program ID: `CWYLQDPfH6eywYGJfrSdX2cVMczm88x3V2Rd4tcgk4jf`)

The `ofund-token-spg/` directory contains the Anchor/Rust source code for the currently active program (`CWYLQDPfH6eywYGJfrSdX2cVMczm88x3V2Rd4tcgk4jf`).

**1. Building the Program:**

   - **Option A: Using Solana Playground:**
     - Copy the contents of `ofund-token-spg/lib.rs` into a Solana Playground workspace.
     - Build the program within Playground. Download the compiled `.so` artifact and the IDL JSON.

   - **Option B: Local Anchor Build (within `ofund-token-spg/`):
     ```bash
     cd otonom-contracts/ofund-token-spg
     # Ensure Anchor and Rust prerequisites are met
     anchor build
     ```
     This will produce `target/deploy/otonom_program.so` and `target/idl/otonom_program.json` (or similar names, ensure they match the expected names `otonom-program.so` and `remote-ofund-idl.json` used by other parts of the project, like the frontend).

**2. Managing Artifacts for Project Integration:**

   When preparing for deployment and integration (e.g., for use by the frontend or deployment scripts), the following artifacts (obtained from Step 1) are key:
   - `otonom-program.so` (the compiled smart contract)
   - `remote-ofund-idl.json` (the IDL file, possibly renamed from the build output)
   - `program-keypair.json` (This is the keypair file that acts as the authority for the deployed program ID `CWYLQDPfH6eywYGJfrSdX2cVMczm88x3V2Rd4tcgk4jf`. **This file is critical and must be securely managed.**)
   These files are typically co-located in the directory from which you execute the `solana program deploy` command.

**3. Deploying/Upgrading the Program:**

   From the directory containing your `otonom-program.so` and the correct `program-keypair.json` for the target program ID, use the Solana CLI to deploy or upgrade:
   ```bash
   # Ensure Solana CLI is configured for devnet
   # solana config set --url devnet

   # Deploy/Upgrade command:
   solana program deploy otonom-program.so --program-id program-keypair.json
   ```
   This command uses the `program-keypair.json` to authorize changes to the program ID `CWYLQDPfH6eywYGJfrSdX2cVMczm88x3V2Rd4tcgk4jf`.

## Verification

All transactions performed by these contracts can be verified on the [Solana Explorer](https://explorer.solana.com/?cluster=devnet) by searching for the Program ID or transaction signatures.