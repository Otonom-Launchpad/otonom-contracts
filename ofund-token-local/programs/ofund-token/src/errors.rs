//! Error types

use anchor_lang::prelude::*;

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
