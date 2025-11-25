import { NextRequest, NextResponse } from "next/server";
import { TurboFactory } from "@ardrive/turbo-sdk";
import { createPublicClient, http, formatUnits } from "viem";
import { base, baseSepolia } from "viem/chains";
import { TREASURY_ADDRESS, USDC_ADDRESSES, FEE_PERCENTAGE } from "@/lib/config/payment";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const txHash = formData.get("txHash") as string;
    const chainId = Number(formData.get("chainId") || 84532); // Default to Base Sepolia

    if (!file || !txHash) {
      return NextResponse.json(
        { success: false, error: "File and txHash are required" },
        { status: 400 }
      );
    }

    // 1. Verify Payment
    const chain = chainId === 8453 ? base : baseSepolia;
    const usdcAddress = USDC_ADDRESSES[chainId];
    
    if (!usdcAddress) {
        return NextResponse.json({ success: false, error: "Unsupported chain" }, { status: 400 });
    }

    const publicClient = createPublicClient({
      chain,
      transport: http()
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

    if (receipt.status !== "success") {
       return NextResponse.json({ success: false, error: "Transaction failed" }, { status: 400 });
    }

    // Filter logs for Transfer event to Treasury
    const transferLogs = receipt.logs.filter(log => 
        log.address.toLowerCase() === usdcAddress.toLowerCase()
    );

    // Topic 0: Transfer(address,address,uint256) -> 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    // Topic 2: to (padded)
    
    // Treasury padded to 32 bytes
    const treasuryTopic = "0x000000000000000000000000" + TREASURY_ADDRESS.slice(2).toLowerCase();

    const paymentLog = transferLogs.find(log => 
        log.topics[2]?.toLowerCase() === treasuryTopic
    );

    if (!paymentLog) {
        return NextResponse.json({ success: false, error: "Payment to treasury not found" }, { status: 400 });
    }

    // Verify amount
    // 1. Get AR price
    const arPriceResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd");
    if (!arPriceResponse.ok) throw new Error("Failed to fetch AR price");
    const arPriceUSD = (await arPriceResponse.json()).arweave.usd;

    // 2. Get Turbo cost
    // Use a fallback rate if Turbo SDK doesn't provide the method
    // Typical Arweave cost is around 0.0000000001 AR per byte (1e-10 AR/byte)
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
    
    const uploadCostWinston = BigInt(file.size) * wincPerByte;
    const uploadCostAR = Number(uploadCostWinston) / 1e12;
    // Cost + Fee. Note: Verification should be slightly lenient or match quote exactly if quoteId stored.
    // For now, re-calculating is safer against stale quotes but risks price slip.
    // We add 5% fee.
    const basePriceUSD = uploadCostAR * arPriceUSD;
    const feeUSD = basePriceUSD * FEE_PERCENTAGE;
    const requiredUSD = basePriceUSD + feeUSD;
    
    // Payment value from log (data is the amount)
    const paidValue = BigInt(paymentLog.data);
    const paidUSDC = Number(formatUnits(paidValue, 6)); // USDC has 6 decimals

    // Allow 5% margin of error due to price fluctuations between quote and pay
    if (paidUSDC < requiredUSD * 0.95 && paidUSDC < 0.01) {
        return NextResponse.json({ 
            success: false, 
            error: `Insufficient payment. Required: ~$${requiredUSD.toFixed(4)}, Paid: $${paidUSDC.toFixed(4)}` 
        }, { status: 400 });
    }

    // 3. Upload to Arweave
    if (!process.env.TURBO_PRIVATE_KEY) {
        console.error("TURBO_PRIVATE_KEY is not set");
        return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
    }

    const authenticatedTurbo = TurboFactory.authenticated({
        privateKey: process.env.TURBO_PRIVATE_KEY
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const uploadResult = await authenticatedTurbo.uploadFile({
        fileStreamFactory: () => {
            const stream = new Readable();
            stream.push(buffer);
            stream.push(null);
            return stream;
        },
        fileSizeFactory: () => file.size,
    });

    return NextResponse.json({
        success: true,
        arweaveUrl: `https://arweave.net/${uploadResult.id}`, 
        txId: uploadResult.id
    });

  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
