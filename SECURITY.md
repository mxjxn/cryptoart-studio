# Security Policy

## Supported Versions

We actively support the latest version of the codebase. Security updates are applied to the main branch.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it via one of the following methods:

1. **Email**: Contact the maintainer directly
2. **Private Security Advisory**: Create a private security advisory on GitHub (if repository is public)

We will acknowledge receipt of your vulnerability report and work with you to understand and resolve the issue quickly.

## Security Best Practices

### Environment Variables

**Never commit sensitive environment variables to the repository.** All secrets must be stored in environment variables:

- Database connection strings (`POSTGRES_URL`, `STORAGE_POSTGRES_URL`)
- API keys (`NEYNAR_API_KEY`, `ALCHEMY_API_KEY`, `GRAPH_STUDIO_API_KEY`)
- Admin configuration (`ADMIN_WALLET_ADDRESS`, `ADMIN_FARCASTER_USERNAME`, `ADMIN_FID`)
- Secrets (`CRON_SECRET`, `ADMIN_SECRET`)

See [docs/ENV_VARS_MANAGEMENT.md](./docs/ENV_VARS_MANAGEMENT.md) for detailed guidance.

### Admin Access

Admin functionality is protected by:
- Wallet address verification (requires ownership of admin wallet)
- Farcaster identity verification (optional, for additional security)

Admin configuration is loaded from environment variables and should never be hardcoded.

### Database Security

- Use connection pooling in production (Supabase pooled connections)
- Never expose database credentials in code or logs
- Use strong, randomly generated passwords
- Rotate credentials regularly

### API Security

- All admin API routes verify admin wallet address
- Cron jobs require `CRON_SECRET` authentication
- Webhook endpoints validate incoming requests
- Rate limiting should be configured at the infrastructure level

### Smart Contracts

- Smart contracts are audited (not original implementations)
- Contract addresses are public and verifiable on-chain
- Never commit private keys or mnemonic phrases

## Known Security Considerations

### Open Source Exposure

This codebase is open source. The following are intentionally exposed:

- **Database Schema**: The schema structure is public (no actual data)
- **Admin Authentication Logic**: Wallet address verification is visible (security through wallet ownership)
- **API Route Structure**: All route definitions are public

**What remains protected:**
- Actual admin wallet address (via environment variables)
- Database credentials (via environment variables)
- API keys and secrets (via environment variables)
- Production data (not in repository)

### Git History

Note that previous commits may contain hardcoded values. When making the repository public, consider:
- The admin address exists in git history
- This is a common tradeoff in open source projects
- Security relies on wallet ownership, not secrecy of the address

## Security Checklist for Deployment

Before deploying, ensure:

- [ ] All `.env*` files are in `.gitignore`
- [ ] No hardcoded API keys or secrets
- [ ] Admin config uses environment variables
- [ ] Database connection strings only in env vars
- [ ] Webhook secrets use env vars
- [ ] Cron secrets use env vars
- [ ] Strong passwords for all services
- [ ] Rate limiting configured
- [ ] Error messages don't leak sensitive information

## Updates

This security policy may be updated as the project evolves. Please check back periodically.

