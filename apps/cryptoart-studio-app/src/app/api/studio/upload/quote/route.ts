import { NextRequest, NextResponse } from "next/server";
import { TurboFactory } from "@ardrive/turbo-sdk";
import { FEE_PERCENTAGE } from "@/lib/config/payment";

export async function POST(request: NextRequest) {
  try {
    const { fileSize } = await request.json();

    if (!fileSize) {
      return NextResponse.json({ error: "fileSize is required" }, { status: 400 });
    }

    // 1. Get AR price in USD
    const arPriceResponse = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd"
    );
    
    if (!arPriceResponse.ok) {
        throw new Error("Failed to fetch AR price");
    }
    
    const arPriceData = await arPriceResponse.json();
    const arPriceUSD = arPriceData.arweave.usd;

    // 2. Get upload cost in AR
    const turbo = TurboFactory.unauthenticated();
    const rates = await turbo.getUploadRates();
    const wincPerByte = rates[0].winc;
    
    const uploadCostWinston = BigInt(fileSize) * BigInt(wincPerByte);
    const uploadCostAR = Number(uploadCostWinston) / 1e12;
    
    const basePriceUSD = uploadCostAR * arPriceUSD;
    const feeUSD = basePriceUSD * FEE_PERCENTAGE;
    const totalEstimatedPriceUSD = basePriceUSD + feeUSD;

    // Minimum 0.01 USDC
    const finalPriceUSD = Math.max(totalEstimatedPriceUSD, 0.01);
    
    return NextResponse.json({
      estimatedPriceUSDC: finalPriceUSD,
      arPriceUSD,
      uploadCostAR,
      quoteId: Date.now().toString(),
    });

  } catch (error) {
    console.error("Quote error:", error);
    return NextResponse.json({ error: "Failed to generate quote" }, { status: 500 });
  }
}

