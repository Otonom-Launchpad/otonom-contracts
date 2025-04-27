import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const PROGRAM_ID = new PublicKey('GAeLTwzvybwxaELbJrPcbjWBaNY5QLHurxXdoPN7jH6D');
const OFUND_MINT = new PublicKey('4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY');

// Read the mint keypair
const mintKeyfilePath = path.resolve('/Users/sistemist/Desktop/Colosseum/Launchpad-WS/keys/ofund_mint.json');
console.log(`Reading mint keypair from: ${mintKeyfilePath}`);
const mintKeyfile = fs.readFileSync(mintKeyfilePath, 'utf-8');
const mintKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(mintKeyfile)));

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Find the mint authority PDA
async function findMintAuthorityPda() {
  const seeds = [Buffer.from('mint-authority'), OFUND_MINT.toBuffer()];
  const [pda, bump] = await PublicKey.findProgramAddress(seeds, PROGRAM_ID);
  return { pda, bump };
}

async function main() {
  console.log('Initializing mint authority PDA for OFUND token...');
  console.log(`Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`OFUND Mint: ${OFUND_MINT.toString()}`);
  
  // Get a recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  
  // Find the mint authority PDA
  const { pda: mintAuthorityPda, bump } = await findMintAuthorityPda();
  console.log(`Mint Authority PDA: ${mintAuthorityPda.toString()}`);
  console.log(`Bump: ${bump}`);
  
  // Create instruction data (initialize_mint instruction index + bump)
  const instructionData = Buffer.from([0, bump]); // Assuming initialize_mint is instruction 0
  
  // Create the instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true }, // admin/payer
      { pubkey: OFUND_MINT, isSigner: false, isWritable: true }, // mint
      { pubkey: mintAuthorityPda, isSigner: false, isWritable: true }, // mint authority pda
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // system program
    ],
    programId: PROGRAM_ID,
    data: instructionData
  });
  
  // Create and sign transaction
  const transaction = new Transaction({ recentBlockhash: blockhash }).add(instruction);
  
  // Sign and send transaction
  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [mintKeypair]);
    console.log('Transaction successful!');
    console.log(`Transaction signature: ${signature}`);
    console.log(`Check on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  } catch (error) {
    console.error('Error executing transaction:');
    console.error(error);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
