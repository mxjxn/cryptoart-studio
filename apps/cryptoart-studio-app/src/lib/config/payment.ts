import { Address } from "viem";

export const TREASURY_ADDRESS = "0x6dA173B1d50F7Bc5c686f8880C20378965408344" as Address;

export const USDC_ADDRESSES: Record<number, Address> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base Mainnet
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
};

export const FEE_PERCENTAGE = 0.05; // 5%

