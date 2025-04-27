use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("EPwpbJYL6H3u3VDMShoJ6XFtdPQ9FJAFpEpjyMH7UADN");

#[program]
pub mod otonom_minimal {
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
        space = 8 + 32 + 1 + 1 + 8,
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
}
