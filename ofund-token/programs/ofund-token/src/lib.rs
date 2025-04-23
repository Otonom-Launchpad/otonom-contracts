use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use std::convert::TryFrom;

declare_id!("Gbq9aJu54T56uUPneuJa2KrCAYZTWx4r2uH78y4pZA7G");

#[program]
pub mod ofund_token {
    use super::*;

    // Initialize the program with a new OFUND token mint
    pub fn initialize_mint(
        ctx: Context<InitializeMint>,
        authority_bump: u8,
        token_name: String,
        token_symbol: String,
        token_uri: String,
        decimals: u8,
    ) -> Result<()> {
        let authority = &mut ctx.accounts.mint_authority;
        authority.bump = authority_bump;
        authority.mint = ctx.accounts.mint.key();
        authority.admin = ctx.accounts.admin.key();
        authority.token_name = token_name;
        authority.token_symbol = token_symbol;
        authority.token_uri = token_uri;
        
        // Record is initialized
        authority.is_initialized = true;

        Ok(())
    }

    // Mint OFUND tokens to a recipient
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        // Only the admin can mint tokens
        require!(
            ctx.accounts.admin.key() == ctx.accounts.mint_authority.admin,
            OFundErrorCode::Unauthorized
        );

        // Create CPI context for token minting
        let seeds = &[
            b"mint-authority".as_ref(),
            ctx.accounts.mint.to_account_info().key.as_ref(),
            &[ctx.accounts.mint_authority.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority_pda.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::mint_to(cpi_ctx, amount)?;

        Ok(())
    }

    // Register user and assign tier based on their token balance
    // Also grants initial 100,000 OFUND tokens (Tier 3 amount) for hackathon demo
    pub fn register_user(
        ctx: Context<RegisterUser>,
        user_bump: u8
    ) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.user = ctx.accounts.user.key();
        user_profile.bump = user_bump;
        
        // Initialize account values
        user_profile.tier = 0; // Will be updated after token grant
        user_profile.total_invested = 0;
        user_profile.investments = Vec::new();
        
        // Grant 100,000 OFUND tokens (Tier 3 amount) for hackathon demo
        // Using 6 decimals as per SPL token standard
        let initial_grant: u64 = 100_000_000_000; // 100,000 tokens with 6 decimals
        
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
        
        // Now update tier based on the new balance (should be Tier 3)
        user_profile.tier = calculate_tier(initial_grant);
        
        Ok(())
    }

    // Update user tier based on their current balance
    pub fn update_user_tier(ctx: Context<UpdateUserTier>) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        let current_balance = ctx.accounts.user_token_account.amount;
        
        user_profile.tier = calculate_tier(current_balance);

        Ok(())
    }
    
    // Get user's investment amount in a specific project
    pub fn get_user_investment(ctx: Context<GetUserInvestment>) -> Result<u64> {
        let user_profile = &ctx.accounts.user_profile;
        let project_key = ctx.accounts.project.key();
        
        // Find the investment record for this project
        let investment = user_profile.investments
            .iter()
            .find(|inv| inv.project == project_key);
            
        // Return the investment amount or 0 if not found
        match investment {
            Some(inv) => Ok(inv.amount),
            None => Ok(0)
        }
    }
    


    // For MVP - Simple token swap for investment
    pub fn invest_in_project(
        ctx: Context<InvestInProject>,
        amount: u64
    ) -> Result<()> {
        // No tier restriction - all users can invest in any project
        // Just make sure the user is registered by checking that they have a user profile
        require!(
            ctx.accounts.user_profile.user == ctx.accounts.investor.key(), 
            OFundErrorCode::InvalidUserProfile
        );

        // Transfer OFUND tokens from investor to project vault
        let transfer_accounts = Transfer {
            from: ctx.accounts.investor_token_account.to_account_info(),
            to: ctx.accounts.project_vault.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
        );
        token::transfer(cpi_ctx, amount)?;

        // Update investment records
        let project = &mut ctx.accounts.project;
        project.total_raised = project.total_raised.checked_add(amount)
            .ok_or(OFundErrorCode::NumericalOverflow)?;
        
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.total_invested = user_profile.total_invested.checked_add(amount)
            .ok_or(OFundErrorCode::NumericalOverflow)?;

        // Record the specific project investment
        // First check if we already have an investment in this project
        let project_key = ctx.accounts.project.key();
        let current_time = Clock::get()?.unix_timestamp;
        
        let existing_investment = user_profile.investments.iter_mut().find(|inv| inv.project == project_key);

        if let Some(inv) = existing_investment {
            // Update existing investment record
            inv.amount = inv.amount.checked_add(amount)
                .ok_or(OFundErrorCode::NumericalOverflow)?;
            inv.timestamp = current_time;
        } else {
            // Add new investment record
            user_profile.investments.push(Investment {
                project: project_key,
                amount,
                timestamp: current_time,
            });
        }

        // For MVP, we're tracking virtual project tokens through the investments vector
        // In a production version, you'd implement actual token transfers and vesting schedules

        Ok(())
    }

    // Initialize a new project for fundraising
    pub fn initialize_project(
        ctx: Context<InitializeProject>,
        project_bump: u8,
        name: String,
        symbol: String,
        description: String,
        target_amount: u64,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        project.admin = ctx.accounts.admin.key();
        project.bump = project_bump;
        project.name = name.clone(); // Clone the name before using it
        project.symbol = symbol;
        project.description = description;
        project.target_amount = target_amount;
        project.total_raised = 0;
        project.min_tier_required = 0; // No tier restriction - open to all users
        project.vault = ctx.accounts.project_vault.key();
        project.is_active = true;

        Ok(())
    }
}

// Calculate tier based on OFUND balance
fn calculate_tier(balance: u64) -> u8 {
    // Tier 1: 1,000 $OFUND
    // Tier 2: 10,000 $OFUND
    // Tier 3: 100,000 $OFUND
    
    // For MVP simplicity, assuming 9 decimal places
    let tier1_threshold = 1_000 * 10u64.pow(9); // 1,000 OFUND
    let tier2_threshold = 10_000 * 10u64.pow(9); // 10,000 OFUND
    let tier3_threshold = 100_000 * 10u64.pow(9); // 100,000 OFUND

    if balance >= tier3_threshold {
        3
    } else if balance >= tier2_threshold {
        2
    } else if balance >= tier1_threshold {
        1
    } else {
        0 // No tier yet
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        mint::decimals = 9, // Standard 9 decimals for Solana tokens
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
        space = MintAuthority::LEN,
        seeds = [b"authority", mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: Account<'info, MintAuthority>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA used as mint authority
    pub mint_authority_pda: UncheckedAccount<'info>,
    
    #[account(
        seeds = [b"authority", mint.key().as_ref()],
        bump,
        constraint = mint_authority.mint == mint.key(),
        constraint = mint_authority.is_initialized == true,
    )]
    pub mint_authority: Account<'info, MintAuthority>,
    
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = UserProfile::size(0),
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
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump = mint_authority.bump,
    )]
    pub mint_authority: Account<'info, MintAuthority>,
    
    /// CHECK: This is the PDA that is the mint authority
    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump = mint_authority.bump,
    )]
    pub mint_authority_pda: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct GetUserInvestment<'info> {
    pub user: Signer<'info>,
    pub user_profile: Account<'info, UserProfile>,
    pub project: Account<'info, Project>,
}

#[derive(Accounts)]
pub struct UpdateUserTier<'info> {
    pub user: Signer<'info>,
    
    #[account(mut, has_one = user)]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
#[instruction(project_bump: u8, name: String, symbol: String, description: String, target_amount: u64)]
pub struct InitializeProject<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = Project::LEN,
        seeds = [b"project", name.as_bytes()],
        bump
    )]
    pub project: Account<'info, Project>,
    
    // Project vault to collect OFUND tokens
    #[account(mut)]
    pub project_vault: Account<'info, TokenAccount>,
    
    // Mint account (OFUND token)
    pub mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

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
        constraint = project.is_active == true,
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
        constraint = project_vault.key() == project.vault,
    )]
    pub project_vault: Account<'info, TokenAccount>,
    
    pub mint: Account<'info, Mint>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Account to store metadata about the mint authority
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

// Account to store user profile and tier information
#[account]
pub struct UserProfile {
    pub user: Pubkey,      // User's wallet address
    pub bump: u8,          // PDA bump
    pub tier: u8,          // User's tier level (0-3)
    pub total_invested: u64, // Total amount invested across all projects
    pub investments: Vec<Investment>, // Record of individual project investments
}

// Structure to track individual project investments
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Investment {
    pub project: Pubkey,   // Project public key
    pub amount: u64,       // Amount invested in this project
    pub timestamp: i64,    // When the investment was made
}

// Account to store project information
#[account]
pub struct Project {
    pub admin: Pubkey,
    pub bump: u8,
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub target_amount: u64,       // Fundraising target
    pub total_raised: u64,        // Total amount raised so far
    pub min_tier_required: u8,    // Minimum tier required to invest (1-3)
    pub vault: Pubkey,            // Vault to collect $OFUND tokens
    pub is_active: bool,          // Whether the project is active
}

// Constants for account sizes
impl MintAuthority {
    pub const LEN: usize = 8 + // discriminator
        1 +                      // bump
        32 +                     // mint
        32 +                     // admin
        64 +                     // token_name
        16 +                     // token_symbol
        128 +                    // token_uri
        1;                       // is_initialized
}

impl UserProfile {
    pub const BASE_LEN: usize = 8 + // discriminator
        32 +                     // user
        1 +                      // bump
        1 +                      // tier
        8 +                      // total_invested
        4;                       // investments vector length (u32)

    // Each investment record size
    pub const INVESTMENT_LEN: usize = 
        32 +                     // project
        8 +                      // amount
        8;                       // timestamp

    // Calculate the size based on the number of investments
    pub fn size(num_investments: usize) -> usize {
        Self::BASE_LEN + (num_investments * Self::INVESTMENT_LEN)
    }
}

impl Project {
    pub const LEN: usize = 8 +  // discriminator
        32 +                     // admin
        1 +                      // bump
        36 +                     // name (4 + 32)
        12 +                     // symbol (4 + 8)
        204 +                    // description (4 + 200)
        8 +                      // target_amount
        8 +                      // total_raised
        1 +                      // min_tier_required
        32 +                     // vault
        1;                       // is_active
}

#[error_code]
pub enum OFundErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Invalid user profile")]
    InvalidUserProfile,
    
    #[msg("Numerical overflow")]
    NumericalOverflow,
    
    #[msg("Project is not active")]
    ProjectNotActive,
    
    #[msg("Investment not found")]
    InvestmentNotFound,
    
    #[msg("Maximum number of investments reached")]
    MaxInvestmentsReached,
}
