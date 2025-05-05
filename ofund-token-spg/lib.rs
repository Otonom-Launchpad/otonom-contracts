use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("CWYLQDPfH6eywYGJfrSdX2cVMczm88x3V2Rd4tcgk4jf");

#[program]
pub mod otonom_program {
    use super::*;

    // Initialize the mint authority for a new OFUND token
    pub fn initialize_mint(
        ctx: Context<InitializeMint>,
        authority_bump: u8,
        token_name: String,
        token_symbol: String,
        token_uri: String,
    ) -> Result<()> {
        let authority = &mut ctx.accounts.mint_authority;
        authority.bump = authority_bump;
        authority.mint = ctx.accounts.mint.key();
        authority.admin = ctx.accounts.admin.key();
        authority.token_name = token_name;
        authority.token_symbol = token_symbol;
        authority.token_uri = token_uri;
        authority.is_initialized = true;

        msg!("Mint authority initialized successfully");
        Ok(())
    }

    // Initialize mint authority for an existing token mint
    pub fn initialize_existing_mint(
        ctx: Context<InitializeExistingMint>,
        authority_bump: u8,
        token_name: String,
        token_symbol: String,
        token_uri: String,
    ) -> Result<()> {
        let authority = &mut ctx.accounts.mint_authority;
        authority.bump = authority_bump;
        authority.mint = ctx.accounts.mint.key();
        authority.admin = ctx.accounts.admin.key();
        authority.token_name = token_name;
        authority.token_symbol = token_symbol;
        authority.token_uri = token_uri;
        authority.is_initialized = true;

        msg!("Mint authority initialized successfully for existing mint");
        Ok(())
    }

    // Register a new user and grant initial tokens
    pub fn register_user(ctx: Context<RegisterUser>, user_bump: u8) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.user = ctx.accounts.user.key();
        user_profile.bump = user_bump;

        // Initialize with Tier 0
        user_profile.tier = 0;
        user_profile.total_invested = 0;

        // Grant initial OFUND tokens for testing (100,000)
        let initial_grant = 100_000 * 10u64.pow(9); // 9 decimals

        // Create CPI context for token minting
        let mint_authority = &ctx.accounts.mint_authority;
        let seeds = &[
            b"mint-authority".as_ref(),
            ctx.accounts.mint.to_account_info().key.as_ref(),
            &[mint_authority.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority_pda.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::mint_to(cpi_ctx, initial_grant)?;

        // Update user tier based on new balance
        user_profile.tier = calculate_tier(initial_grant);

        msg!("User registered successfully and granted initial tokens");
        Ok(())
    }

    // Initialize a new project
    pub fn initialize_project(
        ctx: Context<InitializeProject>,
        project_name: String,
        project_bump: u8,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        project.name = project_name;
        project.bump = project_bump;
        project.authority = ctx.accounts.authority.key();
        project.vault = ctx.accounts.project_vault.key();
        project.total_raised = 0;

        msg!("Project initialized: {}", project.name);
        Ok(())
    }

    // Invest in a project
    pub fn invest_in_project(ctx: Context<InvestInProject>, amount: u64) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        let project = &mut ctx.accounts.project;

        // Transfer tokens from investor to project vault
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.investor_token_account.to_account_info(),
            to: ctx.accounts.project_vault.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer(cpi_ctx, amount)?;

        // Update user's total invested amount
        user_profile.total_invested = user_profile
            .total_invested
            .checked_add(amount)
            .ok_or(error!(OtonomError::ArithmeticOverflow))?;

        // Update project's total raised
        project.total_raised = project
            .total_raised
            .checked_add(amount)
            .ok_or(error!(OtonomError::ArithmeticOverflow))?;

        // Update user tier based on new total
        user_profile.tier = calculate_tier(user_profile.total_invested);

        // Record this investment for on-chain portfolio history
        user_profile.investments.push(Investment {
            project: project.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Investment processed successfully: {} tokens", amount);
        msg!(
            "Project {} has now raised {} tokens",
            project.name,
            project.total_raised
        );
        Ok(())
    }
}

// Calculate tier based on token balance
fn calculate_tier(balance: u64) -> u8 {
    let tier1_threshold = 1_000 * 10u64.pow(9);
    let tier2_threshold = 10_000 * 10u64.pow(9);
    let tier3_threshold = 100_000 * 10u64.pow(9);

    if balance >= tier3_threshold {
        3
    } else if balance >= tier2_threshold {
        2
    } else if balance >= tier1_threshold {
        1
    } else {
        0
    }
}

// Constants for user profile size and investment cap
const MAX_INVESTS: usize = 20; // maximum number of investments stored per user
const INVEST_SIZE: usize = 32 + 8 + 8; // Pubkey (32) + amount (u64) + timestamp (i64)
const USER_PROFILE_SPACE: usize =
    8  + // discriminator
    32 + // user pubkey
    1  + // bump
    1  + // tier
    8  + // total_invested
    4  + // vec length prefix (Anchor serialises Vec with u32 length)
    MAX_INVESTS * INVEST_SIZE;

// Investment struct
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Investment {
    pub project: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// Initialize Mint Authority for New Token
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        mint::decimals = 9,
        mint::authority = mint_authority_pda,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA used as mint authority
    pub mint_authority_pda: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + 1 + 32 + 32 + 4 + 32 + 4 + 16 + 4 + 128 + 1,
        seeds = [b"authority", mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// Initialize Mint Authority for Existing Mint
#[derive(Accounts)]
pub struct InitializeExistingMint<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    // Note: Not initializing the mint, just referencing it
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA used as mint authority
    pub mint_authority_pda: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + 1 + 32 + 32 + 4 + 32 + 4 + 16 + 4 + 128 + 1,
        seeds = [b"authority", mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// Register User
#[derive(Accounts)]
pub struct RegisterUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = USER_PROFILE_SPACE,
        seeds = [b"user-profile", user.key().as_ref()],
        bump,
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == mint.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"authority", mint.key().as_ref()],
        bump = mint_authority.bump,
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    /// CHECK: PDA that is the mint authority
    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump = mint_authority.bump,
    )]
    pub mint_authority_pda: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// Initialize a new project
#[derive(Accounts)]
#[instruction(project_name: String, project_bump: u8)]
pub struct InitializeProject<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 4 + 50 + 1 + 32 + 32 + 8, // Space for account data
        seeds = [b"project", project_name.as_bytes()],
        bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        constraint = project_vault.owner == authority.key(),
    )]
    pub project_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// Invest in a project
#[derive(Accounts)]
pub struct InvestInProject<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user-profile", investor.key().as_ref()],
        bump = user_profile.bump,
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        seeds = [b"project", project.name.as_bytes()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key(),
        constraint = investor_token_account.mint == mint.key(),
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = project_vault.owner == project.authority,
        constraint = project_vault.mint == mint.key(),
    )]
    pub project_vault: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Mint Authority Account
#[account]
pub struct MintAuthority {
    pub bump: u8,
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub token_name: String,
    pub token_symbol: String,
    pub token_uri: String,
    pub is_initialized: bool,
}

// User Profile Account
#[account]
pub struct UserProfile {
    pub user: Pubkey,
    pub bump: u8,
    pub tier: u8,
    pub total_invested: u64,
    pub investments: Vec<Investment>,
}

// Project Account
#[account]
pub struct Project {
    pub name: String,
    pub bump: u8,
    pub authority: Pubkey,
    pub vault: Pubkey,
    pub total_raised: u64,
}

// Error definitions for more robust error handling
#[error_code]
pub enum OtonomError {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Mint authority not initialized")]
    MintAuthorityNotInitialized,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
}
