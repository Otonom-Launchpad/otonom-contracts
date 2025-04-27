// Mint Authority Initialization Script for SPG-deployed program
// This script initializes the mint authority PDA required for the OFUND token
// to be controlled by our deployed program.

const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const fs = require('fs');

// Program and token addresses
const PROGRAM_ID = new PublicKey('EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN');
const OFUND_MINT = new PublicKey('4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Load environment variables
require('dotenv').config();

// Use the SPG wallet keypair that was created during deployment
// This has the proper authority and SOL balance already
// Load from environment variable instead of hardcoding for security
const spgWalletSecretKey = process.env.SPG_WALLET_SECRET_KEY.split(',').map(num => parseInt(num.trim()));

const payerKeypair = Keypair.fromSecretKey(Uint8Array.from(spgWalletSecretKey));

// We'll still need the mint pubkey
const MINT_PUBKEY = new PublicKey('4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY');

async function main() {
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  console.log('Connected to Solana devnet');
  console.log('Program ID:', PROGRAM_ID.toString());
  console.log('OFUND Mint:', OFUND_MINT.toString());
  console.log('Fee Payer Wallet:', payerKeypair.publicKey.toString());
  
  // SPG wallet should already have SOL, no airdrop needed
  console.log('Using existing SPG wallet - no airdrop needed');
  
  // Check updated balance
  const payerBalance = await connection.getBalance(payerKeypair.publicKey);
  console.log(`Fee payer wallet balance: ${payerBalance / 1000000000} SOL`);
  
  // Derive the mint authority PDA
  const [mintAuthorityPda] = await PublicKey.findProgramAddress(
    [Buffer.from('mint-authority'), OFUND_MINT.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Mint Authority PDA:', mintAuthorityPda.toString());
  
  // Derive the authority account PDA that will store data
  const [mintAuthorityAccountPda] = await PublicKey.findProgramAddress(
    [Buffer.from('authority'), OFUND_MINT.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Mint Authority Account PDA:', mintAuthorityAccountPda.toString());

  // These checks are already handled in the airdrop section
  
  // Check if the mint authority account already exists
  const mintAuthorityAccount = await connection.getAccountInfo(mintAuthorityAccountPda);
  if (mintAuthorityAccount) {
    console.log('Mint authority account already exists, no need to initialize');
    return;
  }
  
  // Build instruction data for initialize_mint instruction
  // Anchor instruction: initialize_mint(ctx)
  // For SPG, we'll encode this directly
  const dataLayout = new Uint8Array([0]); // 0 is the discriminator for initialize_mint

  // Create the transaction instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: OFUND_MINT, isSigner: false, isWritable: true }, // mint
      { pubkey: mintAuthorityPda, isSigner: false, isWritable: true }, // mint authority PDA
      { pubkey: mintAuthorityAccountPda, isSigner: false, isWritable: true }, // mint authority account PDA
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent sysvar
    ],
    programId: PROGRAM_ID,
    data: dataLayout,
  });

  // Create and send transaction
  const transaction = new Transaction().add(instruction);
  
  console.log('Sending transaction to initialize mint authority...');
  
  try {
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payerKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log('Transaction successful!');
    console.log('Signature:', txSignature);
    console.log(`Explorer URL: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
    
    // Verify the account was created
    const accountInfo = await connection.getAccountInfo(mintAuthorityAccountPda);
    console.log('Mint authority account created:', !!accountInfo);
    
    return txSignature;
  } catch (error) {
    console.error('Error initializing mint authority:', error);
    
    // Try to extract and log the most helpful error message
    if (error.logs) {
      console.error('Transaction logs:');
      error.logs.forEach(log => console.log(log));
    }
    
    throw error;
  }
}

main()
  .then(() => console.log('Initialization complete'))
  .catch(err => {
    console.error('Failed to initialize mint authority:', err);
    process.exit(1);
  });
