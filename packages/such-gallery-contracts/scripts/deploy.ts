import { ethers } from "hardhat";

/**
 * Deploy such.gallery contracts (GalleryAccount + SuchGallery) to a network.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network base
 *   npx hardhat run scripts/deploy.ts --network base-goerli
 *
 * Env vars (from .env):
 *   DEPLOYER_PRIVATE_KEY — required
 *   BASE_RPC             — RPC URL for Base mainnet
 *   BASE_GOERLI_RPC      — RPC URL for Base Goerli
 */

// ─── ERC-6551 Canonical Addresses ─────────────────────────────────
// Singleton registry deployed at the same address on all EVM chains.
const ERC6551_REGISTRY = "0x000000006551c19487814612e58FE06813775758";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("═══════════════════════════════════════════");
  console.log("  such.gallery — Deploy");
  console.log("═══════════════════════════════════════════");
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  Chain ID:  ${chainId}`);
  console.log(`  Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("");

  // ─── Step 1: Deploy GalleryAccount (ERC-6551 implementation) ────
  console.log("Deploying GalleryAccount (ERC-6551 TBA implementation)...");
  const GalleryAccount = await ethers.getContractFactory("GalleryAccount");
  const galleryAccount = await GalleryAccount.deploy();
  await galleryAccount.waitForDeployment();
  const accountImpl = await galleryAccount.getAddress();
  console.log(`  ✓ GalleryAccount deployed: ${accountImpl}`);

  // ─── Step 2: Deploy SuchGallery ─────────────────────────────────
  console.log("");
  console.log("Deploying SuchGallery (ERC-721 collection)...");
  console.log(`  Registry:     ${ERC6551_REGISTRY}`);
  console.log(`  TBA Impl:     ${accountImpl}`);

  const SuchGallery = await ethers.getContractFactory("SuchGallery");
  const gallery = await SuchGallery.deploy(ERC6551_REGISTRY, accountImpl);
  await gallery.waitForDeployment();
  const galleryAddr = await gallery.getAddress();
  console.log(`  ✓ SuchGallery deployed: ${galleryAddr}`);

  // ─── Step 3: Verify constructor args ─────────────────────────────
  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("  Deployment Summary");
  console.log("═══════════════════════════════════════════");
  console.log(`  GalleryAccount (impl):  ${accountImpl}`);
  console.log(`  SuchGallery (ERC-721):  ${galleryAddr}`);
  console.log(`  ERC-6551 Registry:      ${ERC6551_REGISTRY}`);
  console.log("");

  // Compute counterfactual TBA for token #1
  // Note: this reverts on local Hardhat since the real registry isn't deployed.
  // On live networks (Base, etc.) the singleton registry exists at the canonical address.
  try {
    const tba1 = await gallery.getTokenBoundAccount(1);
    console.log(`  Counterfactual TBA #1:  ${tba1}`);
  } catch {
    console.log("  Counterfactual TBA #1:  (not available on local network — fine for production)");
  }
  console.log("");

  // ─── Verification commands ───────────────────────────────────────
  const networkName = chainId === 8453 ? "base" : chainId === 84531 ? "base-goerli" : `chain-${chainId}`;

  console.log("To verify on Etherscan:");
  console.log(`  npx hardhat verify --network ${networkName} ${accountImpl}`);
  console.log(`  npx hardhat verify --network ${networkName} ${galleryAddr} "${ERC6551_REGISTRY}" "${accountImpl}"`);
  console.log("");

  // ─── Post-deployment checklist ───────────────────────────────────
  console.log("Post-deployment checklist:");
  console.log("  [ ] Verify contracts on Basescan");
  console.log("  [ ] Call startAuction() to begin first daily mint");
  console.log("  [ ] Set up metadata renderer (such.gallery/api/preview/:id)");
  console.log("  [ ] Update frontend with deployed addresses");
  console.log("  [ ] Fund deployer with enough ETH for gas if needed");
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
