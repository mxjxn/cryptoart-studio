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
    // Use a fallback rate if Turbo SDK doesn't provide the method
    // Typical Arweave cost is around 0.0000000001 AR per byte (1e-10 AR/byte)
    // This equals 0.0001 Winston per byte (since 1 AR = 1e12 Winston)
    let wincPerByte = BigInt(100000); // 0.0001 AR per byte as fallback
    
    try {
      const turbo = TurboFactory.unauthenticated();
      // Try to get rates if the method exists
      if (typeof (turbo as any).getUploadRates === 'function') {
        const rates = await (turbo as any).getUploadRates();
        if (rates && rates[0] && rates[0].winc) {
          wincPerByte = BigInt(rates[0].winc);
        }
      }
    } catch (error) {
      console.warn('Could not fetch Turbo upload rates, using fallback:', error);
      // Continue with fallback value
    }
    
    const uploadCostWinston = BigInt(fileSize) * wincPerByte;
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

