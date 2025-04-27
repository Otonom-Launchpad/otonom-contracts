import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OfundToken } from "../target/types/ofund_token";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccount, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { expect } from "chai";

describe("OFUND Token Tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.OfundToken as Program<OfundToken>;
  
  // Generate keypairs for our test
  const admin = anchor.web3.Keypair.generate();
  const investor1 = anchor.web3.Keypair.generate();
  const investor2 = anchor.web3.Keypair.generate();
  
  // We'll set up these variables during the test
  let mintKeypair: anchor.web3.Keypair;
  let mintAuthorityPda: anchor.web3.PublicKey;
  let mintAuthorityBump: number;
  let adminTokenAccount: anchor.web3.PublicKey;
  let investor1TokenAccount: anchor.web3.PublicKey;
  let investor2TokenAccount: anchor.web3.PublicKey;
  let userProfile1: anchor.web3.PublicKey;
  let userProfile1Bump: number;
  let userProfile2: anchor.web3.PublicKey;
  let userProfile2Bump: number;
  let projectPda: anchor.web3.PublicKey;
  let projectBump: number;
  let projectVault: anchor.web3.PublicKey;
  
  const projectName = "AI Assistant Project";
  
  before(async () => {
    // Airdrop SOL to our admin
    const signature = await provider.connection.requestAirdrop(
      admin.publicKey,
      100 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
    
    // Transfer SOL to our investors
    const tx = new anchor.web3.Transaction();
    tx.add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: investor1.publicKey,
        lamports: 10 * anchor.web3.LAMPORTS_PER_SOL,
      }),
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: investor2.publicKey,
        lamports: 10 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    
    await provider.sendAndConfirm(tx, [admin]);
    console.log("Test accounts funded with SOL");
  });
  
  it("Initialize OFUND token", async () => {
    // Generate a new keypair for the mint
    mintKeypair = anchor.web3.Keypair.generate();
    
    // Derive the mint authority PDA
    [mintAuthorityPda, mintAuthorityBump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint-authority"), mintKeypair.publicKey.toBuffer()],
      program.programId
    );
    
    // Find the authority account PDA
    const [authorityPda, authorityBump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), mintKeypair.publicKey.toBuffer()],
      program.programId
    );
    
    // Initialize the mint
    await program.methods
      .initializeMint(
        authorityBump,
        "OFUND Token",
        "OFUND",
        "https://otonom.fund/token-metadata",
        9 // 9 decimals
      )
      .accounts({
        admin: admin.publicKey,
        mint: mintKeypair.publicKey,
        mintAuthorityPda,
        mintAuthority: authorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([admin, mintKeypair])
      .rpc();
      
    console.log("OFUND Token initialized!");
    
    // Create token accounts for our users
    adminTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      mintKeypair.publicKey,
      admin.publicKey
    );
    
    investor1TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin, // Payer
      mintKeypair.publicKey,
      investor1.publicKey
    );
    
    investor2TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin, // Payer
      mintKeypair.publicKey,
      investor2.publicKey
    );
  });
  
  it("Admin mints additional OFUND tokens for project funding", async () => {
    // Find the mint authority PDA
    const [authorityPda, _] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint-authority"), mintKeypair.publicKey.toBuffer()],
      program.programId
    );
    
    // Mint tokens to admin for project funding (1,000,000 OFUND)
    const adminAmount = new anchor.BN(1_000_000 * Math.pow(10, 6));
    await program.methods
      .mintTokens(adminAmount)
      .accounts({
        admin: admin.publicKey,
        mint: mintKeypair.publicKey,
        mintAuthorityPda,
        mintAuthority: authorityPda,
        recipientTokenAccount: adminTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
      
    console.log("Minted 1,000,000 OFUND to admin for project funding");
    
    // Check admin balance
    const adminTokenInfo = await getAccount(provider.connection, adminTokenAccount);
    console.log("Admin token balance:", adminTokenInfo.amount.toString());
  });
  
  it("Register users with automatic token grant", async () => {
    // Derive investor1's user profile PDA
    [userProfile1, userProfile1Bump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user-profile"), investor1.publicKey.toBuffer()],
      program.programId
    );
    
    // Register investor1 - should automatically receive 100,000 tokens (Tier 3)
    await program.methods
      .registerUser(userProfile1Bump)
      .accounts({
        user: investor1.publicKey,
        userProfile: userProfile1,
        mint: mintKeypair.publicKey,
        userTokenAccount: investor1TokenAccount,
        mintAuthority: mintAuthorityPda,
        mintAuthorityPda: mintAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([investor1])
      .rpc();
    
    // Check investor1's token balance (should have 100,000 OFUND)
    const investor1TokenInfo = await getAccount(provider.connection, investor1TokenAccount);
    expect(investor1TokenInfo.amount.toString()).to.equal("100000000000"); // 100,000 with 6 decimals
    
    // Check investor1's tier (should be Tier 3)
    const userProfile1Data = await program.account.userProfile.fetch(userProfile1);
    expect(userProfile1Data.tier).to.equal(3);
    console.log("Investor1 registered with Tier:", userProfile1Data.tier);
    console.log("Investor1 token balance:", investor1TokenInfo.amount.toString());
    
    // Derive investor2's user profile PDA
    [userProfile2, userProfile2Bump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user-profile"), investor2.publicKey.toBuffer()],
      program.programId
    );
    
    // Register investor2 - should also receive 100,000 tokens automatically
    await program.methods
      .registerUser(userProfile2Bump)
      .accounts({
        user: investor2.publicKey,
        userProfile: userProfile2,
        mint: mintKeypair.publicKey,
        userTokenAccount: investor2TokenAccount,
        mintAuthority: mintAuthorityPda,
        mintAuthorityPda: mintAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([investor2])
      .rpc();
    
    // Check investor2's token balance and tier
    const investor2TokenInfo = await getAccount(provider.connection, investor2TokenAccount);
    expect(investor2TokenInfo.amount.toString()).to.equal("100000000000"); // 100,000 with 6 decimals
    
    const userProfile2Data = await program.account.userProfile.fetch(userProfile2);
    expect(userProfile2Data.tier).to.equal(3);
    console.log("Investor2 registered with Tier:", userProfile2Data.tier);
    console.log("Investor2 token balance:", investor2TokenInfo.amount.toString());
  });
  
  it("Query user profile", async () => {
    // Query investor1's user profile
    const userProfile1Data = await program.account.userProfile.fetch(userProfile1);
    console.log("Investor1 user profile:", userProfile1Data);
    
    // Query investor2's user profile
    const userProfile2Data = await program.account.userProfile.fetch(userProfile2);
    console.log("Investor2 user profile:", userProfile2Data);
    expect(userProfile2Data.tier).to.equal(2);
  });
  
  it("Initialize project with no tier restrictions", async () => {
    const projectNameBuffer = Buffer.from(projectName);
    
    // Derive project PDA
    [projectPda, projectBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("project"), projectNameBuffer],
      program.programId
    );
    
    // Get project token vault address
    projectVault = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      projectPda,
      true // allowOwnerOffCurve: true for PDAs
    );
    
    // Initialize project with no tier restriction
    await program.methods
      .initializeProject(
        projectBump,
        projectName,
        "AIPROJ",
        "AI Research Project",
        new anchor.BN(100_000 * Math.pow(10, 6)) // 100,000 OFUND target
      )
      .accounts({
        admin: admin.publicKey,
        project: projectPda,
        projectVault: projectVault,
        mint: mintKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        // Associate token program is handled by Anchor's context
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();
    
    console.log("Project initialized with PDAs");
    
    // Verify project data
    const projectData = await program.account.project.fetch(projectPda);
    expect(projectData.name).to.equal(projectName);
    expect(projectData.symbol).to.equal("AIPROJ");
    expect(projectData.totalRaised.toString()).to.equal("0");
    expect(projectData.minTierRequired).to.equal(0);
    
    console.log("Project data verified - no tier restrictions");
  });
  
  it("Investor makes investment in project and verifies investment tracking", async () => {
    // investor1 invests in the project (all users now have Tier 3)
    const investAmount = new anchor.BN(500 * Math.pow(10, 6)); // 500 OFUND with 6 decimals
    
    await program.methods
      .investInProject(investAmount)
      .accounts({
        investor: investor1.publicKey,
        userProfile: userProfile1,
        investorTokenAccount: investor1TokenAccount,
        project: projectPda,
        projectVault: projectVault,
        mint: mintKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor1])
      .rpc();
      
    console.log("Investor1 invested 500 OFUND in the project");
    
    // Check project total raised
    const projectData = await program.account.project.fetch(projectPda);
    expect(projectData.totalRaised.toString()).to.equal(investAmount.toString());
    console.log("Project total raised:", projectData.totalRaised.toString());
    
    // Check user profile investment record
    const userProfile1Data = await program.account.userProfile.fetch(userProfile1);
    expect(userProfile1Data.totalInvested.toString()).to.equal(investAmount.toString());
    console.log("Investor1 total invested:", userProfile1Data.totalInvested.toString());
    
    // Verify the investment was recorded in the investments vector
    expect(userProfile1Data.investments.length).to.equal(1);
    expect(userProfile1Data.investments[0].project.toString()).to.equal(projectPda.toString());
    expect(userProfile1Data.investments[0].amount.toString()).to.equal(investAmount.toString());
    console.log("Investment record verified in user's profile");
    
    // Make a second investment from investor2
    const investAmount2 = new anchor.BN(1000 * Math.pow(10, 6)); // 1000 OFUND
    
    await program.methods
      .investInProject(investAmount2)
      .accounts({
        investor: investor2.publicKey,
        userProfile: userProfile2,
        investorTokenAccount: investor2TokenAccount,
        project: projectPda,
        projectVault: projectVault,
        mint: mintKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor2])
      .rpc();
      
    console.log("Investor2 invested 1000 OFUND in the project");
    
    // Check updated project total raised (should be 1500 OFUND)
    const updatedProjectData = await program.account.project.fetch(projectPda);
    const expectedTotal = new anchor.BN(1500 * Math.pow(10, 6)); // 1500 OFUND
    expect(updatedProjectData.totalRaised.toString()).to.equal(expectedTotal.toString());
    console.log("Updated project total raised:", updatedProjectData.totalRaised.toString());
    
    // Check investor2's profile
    const userProfile2Data = await program.account.userProfile.fetch(userProfile2);
    expect(userProfile2Data.totalInvested.toString()).to.equal(investAmount2.toString());
    expect(userProfile2Data.investments.length).to.equal(1);
    expect(userProfile2Data.investments[0].project.toString()).to.equal(projectPda.toString());
    expect(userProfile2Data.investments[0].amount.toString()).to.equal(investAmount2.toString());
    console.log("Investor2's investment record verified");
  });
  
  it("Query user investment details", async () => {
    // Use the get_user_investment function to check investment amounts
    const investor1Investment = await program.methods
      .getUserInvestment()
      .accounts({
        user: investor1.publicKey,
        userProfile: userProfile1,
        project: projectPda,
      })
      .view();
    
    // Verify the returned amount matches what we expect
    const expectedAmount = new anchor.BN(500 * Math.pow(10, 6)); // 500 OFUND
    expect(investor1Investment.toString()).to.equal(expectedAmount.toString());
    console.log("Retrieved investor1's investment amount:", investor1Investment.toString());
    
    // Check investor2's investment
    const investor2Investment = await program.methods
      .getUserInvestment()
      .accounts({
        user: investor2.publicKey,
        userProfile: userProfile2,
        project: projectPda,
      })
      .view();
    
    const expectedAmount2 = new anchor.BN(1000 * Math.pow(10, 6)); // 1000 OFUND
    expect(investor2Investment.toString()).to.equal(expectedAmount2.toString());
    console.log("Retrieved investor2's investment amount:", investor2Investment.toString());
    
    // Also check what happens if we query for a non-existent investment
    // Create a dummy project PDA
    const [dummyProjectPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("project"), Buffer.from("Dummy Project")],
      program.programId
    );
    
    // This should return 0 since the user hasn't invested in this project
    const nonExistentInvestment = await program.methods
      .getUserInvestment()
      .accounts({
        user: investor1.publicKey,
        userProfile: userProfile1,
        project: dummyProjectPda,
      })
      .view();
    
    expect(nonExistentInvestment.toString()).to.equal("0");
    console.log("Non-existent investment check passed - returned 0 as expected");
  });
  
  it("Verify project accessibility - no tier restrictions", async () => {
    // Initialize a second project to demonstrate no tier restrictions
    const projectName2 = "Open Access Project";
    const projectNameBuffer2 = Buffer.from(projectName2);
    
    // Derive project PDA
    const [projectPda2, projectBump2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("project"), projectNameBuffer2],
      program.programId
    );
    
    // Get project token vault address
    const projectVault2 = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      projectPda2,
      true // allowOwnerOffCurve: true for PDAs
    );
    
    // Initialize project without tier requirements
    await program.methods
      .initializeProject(
        projectBump2,
        projectName2,
        "OPEN",
        "Open Access Project",
        new anchor.BN(500_000 * Math.pow(10, 6)) // 500,000 OFUND target
      )
      .accounts({
        admin: admin.publicKey,
        project: projectPda2,
        projectVault: projectVault2,
        mint: mintKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        // Associate token program is handled by Anchor's context
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();
    
    console.log("Open access project initialized");
    
    // Fetch project data and verify it has no tier restrictions
    const projectData = await program.account.project.fetch(projectPda2);
    expect(projectData.minTierRequired).to.equal(0);
    console.log("Verified project has no tier restrictions (minTierRequired = 0)");
    
    // Create a brand new investor with minimal tokens (way below Tier 1)
    const minimalInvestor = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to the new investor
    const signature = await provider.connection.requestAirdrop(
      minimalInvestor.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
    
    // Calculate the investor's token account address
    const minimalInvestorTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      minimalInvestor.publicKey
    );
    
    // Create token account
    await createAssociatedTokenAccount(
      provider.connection,
      admin,
      mintKeypair.publicKey,
      minimalInvestor.publicKey
    );
    
    // Mint only 10 tokens to the investor (below Tier 1 minimum)
    await program.methods
      .mintTokens(new anchor.BN(10 * Math.pow(10, 6)))
      .accounts({
        admin: admin.publicKey,
        mintAuthority: mintAuthorityPda,
        mint: mintKeypair.publicKey,
        recipientTokenAccount: minimalInvestorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        mintAuthorityPda: mintAuthorityPda,
      })
      .signers([admin])
      .rpc();
    
    // Create and register user profile for minimal investor
    const [minimalInvestorProfile, minimalInvestorBump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user-profile"), minimalInvestor.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .registerUser(minimalInvestorBump)
      .accounts({
        user: minimalInvestor.publicKey,
        userProfile: minimalInvestorProfile,
        mint: mintKeypair.publicKey,
        userTokenAccount: minimalInvestorTokenAccount,
        mintAuthority: mintAuthorityPda,
        mintAuthorityPda: mintAuthorityPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([minimalInvestor])
      .rpc();
    
    console.log("Created minimal investor with only 10 tokens (below any tier)");
    
    // The minimal investor should still be able to invest despite having very few tokens
    const investAmount = new anchor.BN(1 * Math.pow(10, 6)); // Just 1 OFUND
    
    await program.methods
      .investInProject(investAmount)
      .accounts({
        investor: minimalInvestor.publicKey,
        userProfile: minimalInvestorProfile,
        investorTokenAccount: minimalInvestorTokenAccount,
        project: projectPda2,
        projectVault: projectVault2,
        mint: mintKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([minimalInvestor])
      .rpc();
    
    console.log("Successfully invested with minimal tokens - confirming no tier restrictions enforced");
    
    // Verify the investment was recorded
    const minimalUserProfile = await program.account.userProfile.fetch(minimalInvestorProfile);
    expect(minimalUserProfile.investments.length).to.equal(1);
    expect(minimalUserProfile.investments[0].amount.toString()).to.equal(investAmount.toString());
    
    console.log("Test PASSED: Investor with minimal tokens successfully invested - NO tier restrictions!");
  });
});
