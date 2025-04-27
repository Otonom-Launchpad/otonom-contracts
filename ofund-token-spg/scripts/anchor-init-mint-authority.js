// Professional Anchor client script for initializing mint authority
// This uses proper Anchor encoding for instruction discriminators

const { Program, Wallet, AnchorProvider } = require('@project-serum/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Load program IDL
const idl = JSON.parse(fs.readFileSync('./otonom-frontend/src/lib/ofund-idl.json', 'utf8'));

// Program and token addresses
const PROGRAM_ID = new PublicKey('EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN');
const OFUND_MINT = new PublicKey('4pV3umk8pY62ry8FsnMbQfJBYgpWnzWcC67UCMUevXLY');

// Use the SPG wallet keypair that was created during deployment
const spgWalletSecretKey = [
  67,102,135,211,38,57,7,245,104,84,213,157,3,16,72,150,18,166,183,3,36,86,9,68,37,172,114,28,56,239,244,146,
  8,81,141,151,132,117,57,184,178,19,20,243,189,197,35,104,136,16,227,253,240,176,230,5,236,214,130,210,168,45,12,223
];

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
  console.log('Fee Payer Wallet:', payerKeypair.publicKey.toString());
  
  // Check balance
  const payerBalance = await connection.getBalance(payerKeypair.publicKey);
  console.log(`Fee payer wallet balance: ${payerBalance / 1000000000} SOL`);
  
  // Derive the mint authority PDAs
  const [mintAuthorityPda] = await PublicKey.findProgramAddress(
    [Buffer.from('mint-authority'), OFUND_MINT.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Mint Authority PDA:', mintAuthorityPda.toString());
  
  const [mintAuthorityAccountPda] = await PublicKey.findProgramAddress(
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

    // Call the initialize_mint instruction with proper Anchor encoding
    console.log('Sending transaction to initialize mint authority...');
    
    // Find the PDA bump
    const [_, authorityBump] = await PublicKey.findProgramAddress(
      [Buffer.from('authority'), OFUND_MINT.toBuffer()],
      PROGRAM_ID
    );

    const tx = await program.methods
      .initializeMint(
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
    console.error('Error initializing mint authority:', error);
    
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
