/**
 * Professional mint authority initialization script for OFUND token
 * This directly initializes the mint authority PDA using the deployed program.
 * 
 * For Solana Breakout Hackathon - Otonom Fund Launchpad
 */
const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Constants for Otonom Fund deployment
const PROGRAM_ID = new PublicKey('GAeLTwzvybwxaELbJrPcbjWBaNY5QLHurxXdoPN7jH6D');
const OFUND_MINT = new PublicKey('4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY');
const MINT_KEYPAIR_PATH = '/Users/sistemist/Desktop/Colosseum/Launchpad-WS/keys/ofund_mint.json';

// Connect to Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Load the mint keypair from file
const loadMintKeypair = () => {
  try {
    console.log(`Loading mint keypair from ${MINT_KEYPAIR_PATH}`);
    const keypairData = fs.readFileSync(MINT_KEYPAIR_PATH, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(keypairData));
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Error loading mint keypair:', error);
    process.exit(1);
  }
};

// Find the mint authority PDA
const findMintAuthorityPda = () => {
  // The seeds here must match those in the Anchor contract
  const seeds = [Buffer.from('mint-authority'), OFUND_MINT.toBuffer()];
  const [pda, bump] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
  return { pda, bump };
};

// Find the mint authority account PDA (different from the mint authority PDA)
const findMintAuthorityAccountPda = () => {
  const seeds = [Buffer.from('authority'), OFUND_MINT.toBuffer()];
  const [pda, bump] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
  return { pda, bump };
};

// Main initialization function
async function initializeMintAuthority() {
  console.log('🚀 Initializing mint authority for OFUND token');
  console.log(`Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`OFUND Mint: ${OFUND_MINT.toString()}`);
  
  // Load the mint keypair (this will be the admin/payer)
  const mintKeypair = loadMintKeypair();
  console.log(`Mint keypair public key: ${mintKeypair.publicKey.toString()}`);
  
  // Find the mint authority PDAs
  const { pda: mintAuthorityPda, bump: authorityBump } = findMintAuthorityPda();
  const { pda: mintAuthorityAccountPda, bump: accountBump } = findMintAuthorityAccountPda();
  
  console.log(`Mint Authority PDA: ${mintAuthorityPda.toString()} (bump: ${authorityBump})`);
  console.log(`Mint Authority Account PDA: ${mintAuthorityAccountPda.toString()} (bump: ${accountBump})`);

  // Check if the mint authority PDA already exists
  const pdaAccount = await connection.getAccountInfo(mintAuthorityPda);
  if (pdaAccount) {
    console.log('\n✅ Mint authority PDA already exists with:');
    console.log(`- Owner: ${pdaAccount.owner.toString()}`);
    console.log(`- Lamports: ${pdaAccount.lamports}`);
    console.log(`- Data size: ${pdaAccount.data.length} bytes`);
    
    // Check if the account PDA exists too
    const accountPdaInfo = await connection.getAccountInfo(mintAuthorityAccountPda);
    if (accountPdaInfo) {
      console.log('\n✅ Mint authority account PDA already exists with:');
      console.log(`- Owner: ${accountPdaInfo.owner.toString()}`);
      console.log(`- Lamports: ${accountPdaInfo.lamports}`);
      console.log(`- Data size: ${accountPdaInfo.data.length} bytes`);
      
      console.log('\nMint authority is already initialized. No action needed.');
      return;
    }
  }

  // Create the initialize_mint instruction data
  // Instruction index 0 (initialize_mint) followed by account bump and various parameters
  const token_name = "OFUND Token";
  const token_symbol = "OFUND";
  const token_uri = "https://otonom.fund/token-metadata";
  const decimals = 9;
  
  // Manually construct the instruction data for the initialize_mint instruction
  // Format: [instruction_index(1), authority_bump(1), name_len(4), name(var), symbol_len(4), symbol(var), uri_len(4), uri(var), decimals(1)]
  const nameBuffer = Buffer.from(token_name);
  const symbolBuffer = Buffer.from(token_symbol);
  const uriBuffer = Buffer.from(token_uri);
  
  const instructionData = Buffer.alloc(1 + 1 + 4 + nameBuffer.length + 4 + symbolBuffer.length + 4 + uriBuffer.length + 1);
  let offset = 0;
  
  // Write instruction index (0 for initialize_mint)
  instructionData.writeUInt8(0, offset);
  offset += 1;
  
  // Write authority bump
  instructionData.writeUInt8(authorityBump, offset);
  offset += 1;
  
  // Write token name (length prefixed)
  instructionData.writeUInt32LE(nameBuffer.length, offset);
  offset += 4;
  nameBuffer.copy(instructionData, offset);
  offset += nameBuffer.length;
  
  // Write token symbol (length prefixed)
  instructionData.writeUInt32LE(symbolBuffer.length, offset);
  offset += 4;
  symbolBuffer.copy(instructionData, offset);
  offset += symbolBuffer.length;
  
  // Write token URI (length prefixed)
  instructionData.writeUInt32LE(uriBuffer.length, offset);
  offset += 4;
  uriBuffer.copy(instructionData, offset);
  offset += uriBuffer.length;
  
  // Write decimals
  instructionData.writeUInt8(decimals, offset);
  
  // Create the instruction with all required accounts
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true }, // admin
      { pubkey: OFUND_MINT, isSigner: false, isWritable: true }, // mint
      { pubkey: mintAuthorityPda, isSigner: false, isWritable: true }, // mint authority PDA
      { pubkey: mintAuthorityAccountPda, isSigner: false, isWritable: true }, // mint authority account PDA
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token program
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system program
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent sysvar
    ],
    programId: PROGRAM_ID,
    data: instructionData
  });
  
  // Create and send transaction
  const transaction = new Transaction().add(instruction);
  
  try {
    // Sign and send the transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [mintKeypair] // Only the mint keypair signs
    );
    
    console.log('\n✅ Transaction successful!');
    console.log(`Transaction signature: ${signature}`);
    console.log(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Verify the mint authority PDA was created
    const verifyPdaAccount = await connection.getAccountInfo(mintAuthorityPda);
    if (verifyPdaAccount) {
      console.log('\n✅ Mint authority PDA initialized successfully:');
      console.log(`- Owner: ${verifyPdaAccount.owner.toString()}`);
      console.log(`- Lamports: ${verifyPdaAccount.lamports}`);
      console.log(`- Data size: ${verifyPdaAccount.data.length} bytes`);
    } else {
      console.log('❌ Failed to create mint authority PDA');
    }
    
    // Verify the account PDA was created
    const verifyAccountPda = await connection.getAccountInfo(mintAuthorityAccountPda);
    if (verifyAccountPda) {
      console.log('\n✅ Mint authority account PDA initialized successfully:');
      console.log(`- Owner: ${verifyAccountPda.owner.toString()}`);
      console.log(`- Lamports: ${verifyAccountPda.lamports}`);
      console.log(`- Data size: ${verifyAccountPda.data.length} bytes`);
    } else {
      console.log('❌ Failed to create mint authority account PDA');
    }
  } catch (error) {
    console.error('\n❌ Transaction failed:');
    console.error(error);
    
    if (error.logs) {
      console.error('\nTransaction logs:');
      error.logs.forEach((log, i) => console.error(`${i}: ${log}`));
    }
  }
}

// Run the initialization
initializeMintAuthority().catch(err => {
  console.error('Initialization error:', err);
  process.exit(1);
});
