"use client";

import { useState, useEffect } from "react";
import { useERC20Token } from "~/hooks/useERC20Token";
import { DurationSelector } from "./DurationSelector";

interface ERC721AuctionConfigPageProps {
  contractAddress: string;
  tokenId: string;
  onBack: () => void;
  onSubmit: (data: {
    reservePrice: string;
    paymentType: "ETH" | "ERC20";
    erc20Address: string;
    startTime: string | null;
    endTime: string | null;
    useDuration: boolean;
    durationSeconds: number;
  }) => void;
  isSubmitting?: boolean;
}

/**
 * ERC721 Auction Configuration Page
 */
export function ERC721AuctionConfigPage({
  contractAddress,
  tokenId,
  onBack,
  onSubmit,
  isSubmitting = false,
}: ERC721AuctionConfigPageProps) {
  const [reservePrice, setReservePrice] = useState("");
  const [paymentType, setPaymentType] = useState<"ETH" | "ERC20">("ETH");
  const [erc20Address, setErc20Address] = useState("");
  const [timeMode, setTimeMode] = useState<"start_end" | "duration">("duration");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(7 * 24 * 60 * 60); // Default 1 week

  // Auto-fill start time when switching to start/end mode
  useEffect(() => {
    if (timeMode === "start_end" && !startTime) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setStartTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [timeMode, startTime]);

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
    
    if (!reservePrice || parseFloat(reservePrice) <= 0) {
      alert("Please enter a valid reserve price");
      return;
    }

    onSubmit({
      reservePrice,
      paymentType,
      erc20Address: paymentType === "ERC20" ? erc20Address : "",
      startTime: timeMode === "start_end" ? startTime : null,
      endTime: timeMode === "start_end" ? endTime : null,
      useDuration: timeMode === "duration",
      durationSeconds,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-light mb-2">Auction Configuration</h2>
        <p className="text-sm text-[#999999] mb-4">
          Set your reserve price and auction timeframe
        </p>
      </div>

      {/* Reserve Price */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-2">
          Reserve Price ({priceSymbol})
        </label>
        <input
          type="number"
          step="0.001"
          value={reservePrice}
          onChange={(e) => setReservePrice(e.target.value)}
          className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black"
          placeholder="0.1"
          required
        />
      </div>

      {/* Payment Currency */}
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

      {/* Time Choice */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-3">
          Auction Timing
        </label>
        <div className="space-y-3 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={timeMode === "duration"}
              onChange={() => setTimeMode("duration")}
              className="w-4 h-4 text-white bg-black border-[#333333]"
            />
            <span className="text-sm text-white">Begin on first bid</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={timeMode === "start_end"}
              onChange={() => setTimeMode("start_end")}
              className="w-4 h-4 text-white bg-black border-[#333333]"
            />
            <span className="text-sm text-white">Start and end date</span>
          </label>
        </div>

        {timeMode === "duration" ? (
          <div>
            <label className="block text-xs text-[#cccccc] mb-2">Duration (from first bid)</label>
            <DurationSelector
              value={durationSeconds}
              onChange={setDurationSeconds}
            />
          </div>
        ) : (
          <div className="space-y-4">
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
                required
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
          disabled={isSubmitting || !isValidERC20 || !reservePrice || (timeMode === "start_end" && !endTime)}
          className="flex-1 px-6 py-3 bg-white text-black text-sm font-medium rounded hover:bg-[#cccccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating Auction..." : "Create Auction"}
        </button>
      </div>
    </form>
  );
}

