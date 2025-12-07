"use client";

import { useState, useEffect } from "react";
import { useERC20Token } from "~/hooks/useERC20Token";
import { zeroAddress } from "viem";

interface ERC1155ConfigPageProps {
  contractAddress: string;
  tokenId: string;
  balance: number; // ERC1155 balance owned
  onBack: () => void;
  onSubmit: (data: {
    price: string;
    quantity: number;
    paymentType: "ETH" | "ERC20";
    erc20Address: string;
    startTime: string | null;
    endTime: string | null;
    noTimeframe: boolean;
  }) => void;
  isSubmitting?: boolean;
}

/**
 * ERC1155 Fixed Price Configuration Page
 */
export function ERC1155ConfigPage({
  contractAddress,
  tokenId,
  balance,
  onBack,
  onSubmit,
  isSubmitting = false,
}: ERC1155ConfigPageProps) {
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentType, setPaymentType] = useState<"ETH" | "ERC20">("ETH");
  const [erc20Address, setErc20Address] = useState("");
  const [useTimeframe, setUseTimeframe] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Auto-fill start time with current date/time
  useEffect(() => {
    if (useTimeframe && !startTime) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setStartTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [useTimeframe, startTime]);

  const erc20Token = useERC20Token(paymentType === "ERC20" ? erc20Address : undefined);
  const isValidERC20 = paymentType === "ETH" || (paymentType === "ERC20" && erc20Token.isValid);
  const priceSymbol = paymentType === "ETH" ? "ETH" : (erc20Token.symbol || "TOKEN");

  const handleQuickEndTime = (hours: number) => {
    if (!startTime) return;
    const start = new Date(startTime);
    start.setHours(start.getHours() + hours);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, "0");
    const day = String(start.getDate()).padStart(2, "0");
    const hrs = String(start.getHours()).padStart(2, "0");
    const mins = String(start.getMinutes()).padStart(2, "0");
    setEndTime(`${year}-${month}-${day}T${hrs}:${mins}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!price || parseFloat(price) <= 0) {
      alert("Please enter a valid price");
      return;
    }

    const quantityNum = parseInt(quantity);
    if (quantityNum < 1 || quantityNum > balance) {
      alert(`Quantity must be between 1 and ${balance}`);
      return;
    }

    onSubmit({
      price,
      quantity: quantityNum,
      paymentType,
      erc20Address: paymentType === "ERC20" ? erc20Address : "",
      startTime: useTimeframe ? startTime : null,
      endTime: useTimeframe ? endTime : null,
      noTimeframe: !useTimeframe,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-light mb-2">Fixed Price Listing</h2>
        <p className="text-sm text-[#999999] mb-4">
          Configure your ERC1155 listing (fixed price only)
        </p>
      </div>

      {/* Quantity Selector */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-2">
          Quantity (you have {balance} available)
        </label>
        <input
          type="number"
          min="1"
          max={balance}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black"
          required
        />
      </div>

      {/* Payment Currency Selection */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-3">
          Payment Currency
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentType("ETH")}
            className={`px-4 py-2 text-sm rounded border transition-colors ${
              paymentType === "ETH"
                ? "bg-white text-black border-white"
                : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
            }`}
          >
            ETH
          </button>
          <button
            type="button"
            onClick={() => setPaymentType("ERC20")}
            className={`px-4 py-2 text-sm rounded border transition-colors ${
              paymentType === "ERC20"
                ? "bg-white text-black border-white"
                : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
            }`}
          >
            ERC20 Token
          </button>
        </div>

        {paymentType === "ERC20" && (
          <div className="mt-3">
            <input
              type="text"
              value={erc20Address}
              onChange={(e) => setErc20Address(e.target.value)}
              placeholder="0x... (ERC20 Token Address)"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black font-mono text-sm ${
                erc20Address && erc20Token.error
                  ? "border-red-500"
                  : erc20Address && erc20Token.isValid
                  ? "border-green-500"
                  : "border-[#333333]"
              }`}
            />
            {erc20Address && erc20Token.isValid && (
              <p className="mt-1 text-xs text-green-400">
                {erc20Token.name} ({erc20Token.symbol})
              </p>
            )}
          </div>
        )}
      </div>

      {/* Price Input */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-2">
          Price Per Copy ({priceSymbol})
        </label>
        <input
          type="number"
          step="0.001"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black"
          placeholder="0.1"
          required
        />
      </div>

      {/* Timeframe Options */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-3">
          Timeframe
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={useTimeframe}
              onChange={() => setUseTimeframe(true)}
              className="w-4 h-4 text-white bg-black border-[#333333]"
            />
            <span className="text-sm text-white">Start and end date</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!useTimeframe}
              onChange={() => setUseTimeframe(false)}
              className="w-4 h-4 text-white bg-black border-[#333333]"
            />
            <div>
              <span className="text-sm text-white">No timeframe - open until sold out</span>
              <p className="text-xs text-[#666666] mt-0.5">
                Listing starts immediately and remains active for ~100 years or until all copies are sold
              </p>
            </div>
          </label>
        </div>

        {useTimeframe && (
          <div className="mt-4 space-y-4">
            {/* Start Time */}
            <div>
              <label className="block text-xs text-[#cccccc] mb-2">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-[#333333] text-white text-sm rounded focus:ring-2 focus:ring-white focus:border-white"
              />
            </div>

            {/* End Time with Quick Options */}
            <div>
              <label className="block text-xs text-[#cccccc] mb-2">End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-[#333333] text-white text-sm rounded focus:ring-2 focus:ring-white focus:border-white mb-2"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(24)}
                  className="px-3 py-1 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded hover:border-[#555555] transition-colors"
                >
                  24hr
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(48)}
                  className="px-3 py-1 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded hover:border-[#555555] transition-colors"
                >
                  48hr
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(24 * 7)}
                  className="px-3 py-1 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded hover:border-[#555555] transition-colors"
                >
                  1wk
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(24 * 14)}
                  className="px-3 py-1 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded hover:border-[#555555] transition-colors"
                >
                  2wk
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-[#333333]">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium rounded hover:border-[#555555] transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isValidERC20 || !price || parseFloat(quantity) < 1}
          className="flex-1 px-6 py-3 bg-white text-black text-sm font-medium rounded hover:bg-[#cccccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating Listing..." : "Create Listing"}
        </button>
      </div>
    </form>
  );
}

