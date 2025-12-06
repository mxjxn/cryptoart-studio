# Documentation Index

This directory contains all project documentation. Use this guide to quickly find what you need.

## 🚀 Deployment Guides

### [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md)
**TL;DR**: 5-minute setup checklist for deploying cryptoart.social to Hostinger. Quick commands, common tasks, and troubleshooting.

**When to use**: You want to deploy quickly and need a condensed reference.

---

### [DEPLOYMENT_PRODUCTION.md](./DEPLOYMENT_PRODUCTION.md)
**TL;DR**: Complete step-by-step guide for production deployment on Hostinger KVM2. Includes server setup, Docker Compose, GitHub Actions CI/CD, SSL configuration, and monitoring.

**When to use**: First-time deployment or detailed setup instructions.

---

### [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
**TL;DR**: Overview of all deployment files (Dockerfiles, docker-compose, GitHub Actions, nginx configs) and their purposes. Quick reference for the deployment architecture.

**When to use**: Understanding what deployment files exist and how they work together.

---

### [DEPLOYMENT.md](./DEPLOYMENT.md)
**TL;DR**: General deployment guide for all projects in the monorepo. Covers shared infrastructure, database setup, and deployment options for each app.

**When to use**: Deploying any project in the monorepo, understanding shared infrastructure.

---

## 🔐 Configuration & Security

### [ENV_VARS_MANAGEMENT.md](./ENV_VARS_MANAGEMENT.md)
**TL;DR**: Secure environment variable management guide. Docker secrets, GitHub Actions secrets, rotation procedures, and security best practices.

**When to use**: Setting up production environment variables, rotating secrets, understanding security practices.

---

### [NGINX_REVERSE_PROXY_GUIDE.md](./NGINX_REVERSE_PROXY_GUIDE.md)
**TL;DR**: Complete guide for setting up nginx reverse proxy on Hostinger. Multi-domain routing, internal service communication, SSL/TLS setup, and advanced configuration.

**When to use**: Setting up nginx for multiple domains, routing internal services, SSL configuration.

---

## 🗄️ Infrastructure & Services

### [LOCAL_SERVICES_SETUP.md](./LOCAL_SERVICES_SETUP.md)
**TL;DR**: How to run PostgreSQL and Redis locally using Docker Compose for development. Quick commands and best practices.

**When to use**: Setting up local development environment, testing without remote databases.

---

### [INDEXER_IMPLEMENTATION_SUMMARY.md](./INDEXER_IMPLEMENTATION_SUMMARY.md)
**TL;DR**: Overview of the Creator Core Indexer implementation. Architecture, event processing, metadata fetching, and deployment options.

**When to use**: Understanding how the indexer works, troubleshooting indexing issues.

---

## 📦 Packages & Integration

### [PACKAGES.md](./PACKAGES.md)
**TL;DR**: Documentation for shared packages in the monorepo. Database config, UI components, TypeScript configs, and other shared utilities.

**When to use**: Understanding shared packages, integrating with workspace packages.

---

### [LSSVM_INTEGRATION.md](./LSSVM_INTEGRATION.md)
**TL;DR**: Guide for integrating LSSVM (Liquidity-Sensitive Swap Virtual Machine) pools for NFT trading. Contract addresses, integration patterns, and usage examples.

**When to use**: Integrating LSSVM pools, creating NFT trading pools.

---

## 📋 Project Management

### [TASKLIST.md](./TASKLIST.md)
**TL;DR**: Active task tracking for the monorepo. High-priority testing items, in-progress work, completed tasks, and items needing attention.

**When to use**: Understanding current project status, finding tasks to work on.

---

### [STATUS_AND_NEXT_STEPS.md](./STATUS_AND_NEXT_STEPS.md)
**TL;DR**: Comprehensive project status assessment. Completed infrastructure, manual tasks required, testing checklist, and next steps.

**When to use**: Getting an overview of project status, understanding what's done and what's needed.

---

### [ENGAGEMENT_ROADMAP.md](./ENGAGEMENT_ROADMAP.md)
**TL;DR**: Long-term roadmap for user engagement features. Community building, creator tools, and growth strategies.

**When to use**: Planning future features, understanding product direction.

---

## 📄 Reference

### [CONTRACT_ADDRESSES.md](./CONTRACT_ADDRESSES.md)
**TL;DR**: Complete list of all deployed contract addresses across all networks (Base Mainnet, Base Sepolia, etc.). Includes auctionhouse, LSSVM, and Creator Core contracts.

**When to use**: Finding contract addresses, verifying deployments, integration.

---

### [llms-full.md](./llms-full.md)
**TL;DR**: Complete technical documentation consolidated from all projects. Architecture, deployment guides, quick references, and technical notes. Optimized for LLM/AI consumption.

**When to use**: Comprehensive understanding of the entire codebase, AI/LLM context.

---

## 🗺️ Quick Navigation by Goal

### I want to...

**Deploy to production**
1. Start with [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md) for fast setup
2. Or [DEPLOYMENT_PRODUCTION.md](./DEPLOYMENT_PRODUCTION.md) for detailed guide
3. Configure nginx: [NGINX_REVERSE_PROXY_GUIDE.md](./NGINX_REVERSE_PROXY_GUIDE.md)
4. Set up secrets: [ENV_VARS_MANAGEMENT.md](./ENV_VARS_MANAGEMENT.md)

**Set up local development**
1. [LOCAL_SERVICES_SETUP.md](./LOCAL_SERVICES_SETUP.md) for database setup
2. [DEPLOYMENT.md](./DEPLOYMENT.md) for general setup

**Understand the project**
1. [STATUS_AND_NEXT_STEPS.md](./STATUS_AND_NEXT_STEPS.md) for current status
2. [TASKLIST.md](./TASKLIST.md) for active tasks
3. [PACKAGES.md](./PACKAGES.md) for package structure

**Find contract addresses**
- [CONTRACT_ADDRESSES.md](./CONTRACT_ADDRESSES.md)

**Integrate with services**
- LSSVM: [LSSVM_INTEGRATION.md](./LSSVM_INTEGRATION.md)
- Indexer: [INDEXER_IMPLEMENTATION_SUMMARY.md](./INDEXER_IMPLEMENTATION_SUMMARY.md)

**Get comprehensive overview**
- [llms-full.md](./llms-full.md) for complete technical docs

---

## 📚 Documentation Structure

```
docs/
├── README.md (this file)
│
├── 🚀 Deployment
│   ├── DEPLOYMENT_QUICKSTART.md
│   ├── DEPLOYMENT_PRODUCTION.md
│   ├── DEPLOYMENT_SUMMARY.md
│   └── DEPLOYMENT.md
│
├── 🔐 Configuration
│   ├── ENV_VARS_MANAGEMENT.md
│   └── NGINX_REVERSE_PROXY_GUIDE.md
│
├── 🗄️ Infrastructure
│   ├── LOCAL_SERVICES_SETUP.md
│   └── INDEXER_IMPLEMENTATION_SUMMARY.md
│
├── 📦 Packages
│   ├── PACKAGES.md
│   └── LSSVM_INTEGRATION.md
│
├── 📋 Project Management
│   ├── TASKLIST.md
│   ├── STATUS_AND_NEXT_STEPS.md
│   └── ENGAGEMENT_ROADMAP.md
│
└── 📄 Reference
    ├── CONTRACT_ADDRESSES.md
    └── llms-full.md
```

---

**Need help?** Start with [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md) for deployment or [STATUS_AND_NEXT_STEPS.md](./STATUS_AND_NEXT_STEPS.md) for project overview.









