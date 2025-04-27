// Professional Anchor client script for initializing authority for an existing mint
// Uses the new initializeExistingMint instruction in our updated contract

const { Program, Wallet, AnchorProvider } = require('@project-serum/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Load program IDL
const idl = JSON.parse(fs.readFileSync('./otonom-frontend/src/lib/ofund-idl.json', 'utf8'));

// Program ID and existing OFUND token mint address
const PROGRAM_ID = new PublicKey('EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN');
const OFUND_MINT = new PublicKey('4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY');

// Load environment variables
require('dotenv').config();

// Use the SPG wallet keypair that was created during deployment
// Load from environment variable instead of hardcoding for security
const spgWalletSecretKey = process.env.SPG_WALLET_SECRET_KEY.split(',').map(num => parseInt(num.trim()));

const payerKeypair = Keypair.fromSecretKey(Uint8Array.from(spgWalletSecretKey));

async function main() {
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  console.log('Connected to Solana devnet');

  // Create Anchor provider
  const provider = new AnchorProvider(
    connection,
    new Wallet(payerKeypair),
    { commitment: 'confirmed' }
  );

  // Create program instance
  const program = new Program(idl, PROGRAM_ID, provider);
  
  // Display information
  console.log('Program ID:', PROGRAM_ID.toString());
  console.log('OFUND Mint:', OFUND_MINT.toString());
  console.log('Admin Wallet:', payerKeypair.publicKey.toString());
  
  // Check balance
  const payerBalance = await connection.getBalance(payerKeypair.publicKey);
  console.log(`Admin wallet balance: ${payerBalance / 1000000000} SOL`);
  
  // Derive the mint authority PDAs
  const [mintAuthorityPda] = await PublicKey.findProgramAddress(
    [Buffer.from('mint-authority'), OFUND_MINT.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Mint Authority PDA:', mintAuthorityPda.toString());
  
  const [mintAuthorityAccountPda, authorityBump] = await PublicKey.findProgramAddress(
    [Buffer.from('authority'), OFUND_MINT.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Mint Authority Account PDA:', mintAuthorityAccountPda.toString());

  try {
    // Check if mint authority already exists
    try {
      const mintAuthorityAccount = await program.account.mintAuthority.fetch(mintAuthorityAccountPda);
      console.log('Mint authority account already exists:', mintAuthorityAccount);
      return;
    } catch (err) {
      console.log('Mint authority account does not exist yet, initializing...');
    }

    // Call the initializeExistingMint instruction with proper Anchor encoding
    console.log('Sending transaction to initialize existing mint authority...');
    
    // Use our new instruction for existing mints
    const tx = await program.methods
      .initializeExistingMint(
        authorityBump,
        'OFUND Token',
        'OFUND',
        'https://otonom.fund/token-metadata'
      )
      .accounts({
        admin: payerKeypair.publicKey,
        mint: OFUND_MINT,
        mintAuthorityPda: mintAuthorityPda,
        mintAuthority: mintAuthorityAccountPda,
        tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        systemProgram: new PublicKey('11111111111111111111111111111111'),
        rent: new PublicKey('SysvarRent111111111111111111111111111111111')
      })
      .signers([payerKeypair])
      .rpc();
    
    console.log('Transaction successful!');
    console.log('Signature:', tx);
    console.log(`Explorer URL: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
    // Verify the account was created
    const accountInfo = await program.account.mintAuthority.fetch(mintAuthorityAccountPda);
    console.log('Mint authority account created successfully:', !!accountInfo);
    console.log('Mint authority data:', accountInfo);
    
    return tx;
  } catch (error) {
    console.error('Error initializing existing mint authority:', error);
    
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
