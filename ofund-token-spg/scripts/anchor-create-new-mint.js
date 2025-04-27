// Professional Anchor client script for creating a new token and initializing mint authority
// This uses proper Anchor encoding for instruction discriminators

const { Program, Wallet, AnchorProvider } = require('@project-serum/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Load program IDL
const idl = JSON.parse(fs.readFileSync('./otonom-frontend/src/lib/ofund-idl.json', 'utf8'));

// Program ID
const PROGRAM_ID = new PublicKey('EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN');

// Use the SPG wallet keypair that was created during deployment
// Load environment variables
require('dotenv').config();

// Load SPG wallet key from environment variables instead of hardcoding for security
const spgWalletSecretKey = process.env.SPG_WALLET_SECRET_KEY.split(',').map(num => parseInt(num.trim()));

const payerKeypair = Keypair.fromSecretKey(Uint8Array.from(spgWalletSecretKey));

// Create a new mint keypair
const mintKeypair = Keypair.generate();

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
  console.log('New OFUND Mint:', mintKeypair.publicKey.toString());
  console.log('Fee Payer Wallet:', payerKeypair.publicKey.toString());
  
  // Check balance
  const payerBalance = await connection.getBalance(payerKeypair.publicKey);
  console.log(`Fee payer wallet balance: ${payerBalance / 1000000000} SOL`);
  
  // Derive the mint authority PDAs
  const [mintAuthorityPda] = await PublicKey.findProgramAddress(
    [Buffer.from('mint-authority'), mintKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Mint Authority PDA:', mintAuthorityPda.toString());
  
  const [mintAuthorityAccountPda, authorityBump] = await PublicKey.findProgramAddress(
    [Buffer.from('authority'), mintKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Mint Authority Account PDA:', mintAuthorityAccountPda.toString());

  try {
    // Call the initialize_mint instruction with proper Anchor encoding
    console.log('Sending transaction to initialize mint...');
    
    const tx = await program.methods
      .initializeMint(
        authorityBump,
        'OFUND Token',
        'OFUND',
        'https://otonom.fund/token-metadata',
        9  // 9 decimals
      )
      .accounts({
        admin: payerKeypair.publicKey,
        mint: mintKeypair.publicKey, 
        mintAuthorityPda: mintAuthorityPda,
        mintAuthority: mintAuthorityAccountPda,
        tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        systemProgram: new PublicKey('11111111111111111111111111111111'),
        rent: new PublicKey('SysvarRent111111111111111111111111111111111')
      })
      .signers([payerKeypair, mintKeypair])
      .rpc();
    
    console.log('Transaction successful!');
    console.log('Signature:', tx);
    console.log(`Explorer URL: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
    // Save the mint address to a file for future reference
    fs.writeFileSync('./new-mint-address.txt', mintKeypair.publicKey.toString());
    
    console.log('New token mint address saved to new-mint-address.txt');
    console.log('');
    console.log('--------------------------------');
    console.log('IMPORTANT: Update your frontend config with this mint address:');
    console.log(mintKeypair.publicKey.toString());
    console.log('--------------------------------');
    
    return tx;
  } catch (error) {
    console.error('Error initializing mint:', error);
    
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
    console.error('Failed to initialize mint:', err);
    process.exit(1);
  });
