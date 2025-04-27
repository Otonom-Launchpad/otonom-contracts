/**
 * Script to initialize mint authority PDA for the OFUND token
 * Professional approach: Direct Web3.js transaction to initialize the PDA without redeploying
 */

const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

// Constants for the Otonom Fund hackathon
const PROGRAM_ID = new PublicKey('GAeLTwzvybwxaELbJrPcbjWBaNY5QLHurxXdoPN7jH6D');
const OFUND_MINT = new PublicKey('4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY');
const MINT_KEYPAIR_PATH = '/Users/sistemist/Desktop/Colosseum/Launchpad-WS/keys/ofund_mint.json';

// Load mint keypair (this will be the transaction signer)
const loadMintKeypair = () => {
  try {
    const keypairData = fs.readFileSync(MINT_KEYPAIR_PATH, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(keypairData));
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading mint keypair:', error);
    process.exit(1);
  }
};

// Find the mint authority PDA (matches calculation in the Anchor contract)
const findMintAuthorityPda = async () => {
  // The seeds here must match exactly what's in the contract 
  const seeds = [Buffer.from('mint-authority'), OFUND_MINT.toBuffer()];
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
};

// Main function
async function main() {
  console.log('🚀 Initializing Mint Authority PDA for OFUND token');
  console.log(`Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`OFUND Mint: ${OFUND_MINT.toString()}`);
  
  // 1. Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // 2. Load mint keypair
  const mintKeypair = loadMintKeypair();
  console.log(`Mint Keypair loaded, public key: ${mintKeypair.publicKey.toString()}`);
  
  // 3. Find mint authority PDA
  const [mintAuthorityPda, bump] = findMintAuthorityPda();
  console.log(`Mint Authority PDA: ${mintAuthorityPda.toString()}`);
  console.log(`Bump seed: ${bump}`);
  
  // 4. Create transaction instruction
  // This directly creates the initialize_mint_authority instruction
  // Instruction index 0 (initialize_mint_authority) followed by bump seed
  const data = Buffer.from([0, bump]);
  
  // Create instruction with all required accounts (matching the contract's InitializeMint context)
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true }, // admin/payer - must be the mint keypair
      { pubkey: OFUND_MINT, isSigner: false, isWritable: true }, // mint
      { pubkey: mintAuthorityPda, isSigner: false, isWritable: true }, // mint authority PDA
      { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false }, // TOKEN_PROGRAM_ID
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // SystemProgram.programId
    ],
    programId: PROGRAM_ID,
    data
  });
  
  // 5. Create and send transaction
  const transaction = new Transaction().add(instruction);
  
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [mintKeypair], // Only the mint keypair needs to sign
      { commitment: 'confirmed' }
    );
    
    console.log('✅ Transaction successful!');
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Verify the mint authority PDA account now exists
    console.log('\n🔍 Verifying mint authority PDA account...');
    const pdaAccount = await connection.getAccountInfo(mintAuthorityPda);
    
    if (pdaAccount) {
      console.log('✅ Mint authority PDA account verified with:');
      console.log(`- Owner: ${pdaAccount.owner.toString()}`);
      console.log(`- Lamports: ${pdaAccount.lamports}`);
      console.log(`- Data size: ${pdaAccount.data.length} bytes`);
    } else {
      console.log('❌ Mint authority PDA account not found. Initialization may have failed.');
    }
    
  } catch (error) {
    console.error('\n❌ Transaction failed:', error);
    
    // Provide helpful error diagnostics
    if (error.logs) {
      console.error('\nTransaction logs:');
      error.logs.forEach((log, i) => console.error(`${i}: ${log}`));
    }
  }
}

main();
