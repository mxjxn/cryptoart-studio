"use client";

import { useState, useEffect, useMemo } from "react";
import { useERC20Token } from "~/hooks/useERC20Token";
import { DurationSelector } from "./DurationSelector";
import { NumberSelector } from "./NumberSelector";
import { DateSelector, getMinDateTime, getMaxDateTime, getDateTimeAfterHours } from "./DateSelector";

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
  const [reservePrice, setReservePrice] = useState("0.1"); // Sensible default
  const [paymentType, setPaymentType] = useState<"ETH" | "ERC20">("ETH");
  const [erc20Address, setErc20Address] = useState("");
  const [timeMode, setTimeMode] = useState<"start_end" | "duration">("duration");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(7 * 24 * 60 * 60); // Default 1 week
  
  // Validation state
  const [reservePriceValid, setReservePriceValid] = useState(true);
  const [reservePriceError, setReservePriceError] = useState<string | undefined>();
  const [startTimeValid, setStartTimeValid] = useState(true);
  const [startTimeError, setStartTimeError] = useState<string | undefined>();
  const [endTimeValid, setEndTimeValid] = useState(true);
  const [endTimeError, setEndTimeError] = useState<string | undefined>();

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

  // Overall form validation
  const isFormValid = useMemo(() => {
    if (!reservePriceValid) return false;
    if (timeMode === "start_end") {
      if (!startTimeValid || !endTimeValid) return false;
      if (!startTime || !endTime) return false;
    }
    if (!isValidERC20) return false;
    return true;
  }, [reservePriceValid, startTimeValid, endTimeValid, timeMode, startTime, endTime, isValidERC20]);

  // Collect all errors
  const allErrors = useMemo(() => {
    const errors: string[] = [];
    if (!reservePriceValid && reservePriceError) errors.push(`Reserve Price: ${reservePriceError}`);
    if (timeMode === "start_end") {
      if (!startTimeValid && startTimeError) errors.push(`Start Time: ${startTimeError}`);
      if (!endTimeValid && endTimeError) errors.push(`End Time: ${endTimeError}`);
    }
    if (!isValidERC20 && paymentType === "ERC20") {
      errors.push("ERC20 Address: Please enter a valid ERC20 token address");
    }
    return errors;
  }, [reservePriceValid, reservePriceError, startTimeValid, startTimeError, endTimeValid, endTimeError, isValidERC20, paymentType, timeMode]);

  const handleQuickEndTime = (hours: number) => {
    if (!startTime) return;
    const start = new Date(startTime);
    // Use setTime to properly handle month/year boundaries when adding large hour values
    start.setTime(start.getTime() + hours * 60 * 60 * 1000);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, "0");
    const day = String(start.getDate()).padStart(2, "0");
    const hrs = String(start.getHours()).padStart(2, "0");
    const mins = String(start.getMinutes()).padStart(2, "0");
    setEndTime(`${year}-${month}-${day}T${hrs}:${mins}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) {
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
    <form onSubmit={handleSubmit} className="space-y-6 font-space-grotesk">
      <div>
        <h2 className="mb-2 text-xl font-medium text-neutral-900">Auction configuration</h2>
        <p className="mb-4 text-sm text-neutral-600">Set your reserve price and auction timeframe.</p>
      </div>

      {/* Reserve Price */}
      <NumberSelector
        value={reservePrice}
        onChange={setReservePrice}
        onValidationChange={(isValid, error) => {
          setReservePriceValid(isValid);
          setReservePriceError(error);
        }}
        min={0.001}
        step={0.001}
        label={`Reserve Price (${priceSymbol})`}
        placeholder="0.1"
        required
      />

      {/* Payment Currency */}
      <div>
        <label className="mb-3 block text-sm font-medium text-neutral-700">Payment currency</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentType("ETH")}
            className={`rounded border px-4 py-2 text-sm transition-colors ${
              paymentType === "ETH"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
            }`}
          >
            ETH
          </button>
          <button
            type="button"
            onClick={() => setPaymentType("ERC20")}
            className={`rounded border px-4 py-2 text-sm transition-colors ${
              paymentType === "ERC20"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
            }`}
          >
            ERC20 token
          </button>
        </div>

        {paymentType === "ERC20" && (
          <div className="mt-3">
            <input
              type="text"
              value={erc20Address}
              onChange={(e) => setErc20Address(e.target.value)}
              placeholder="0x... (ERC20 token address)"
              className={`w-full rounded-lg border bg-white px-4 py-2 font-mono text-sm text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20 ${
                erc20Address && erc20Token.error
                  ? "border-red-500"
                  : erc20Address && erc20Token.isValid
                    ? "border-green-500"
                    : "border-neutral-200"
              }`}
            />
            {erc20Address && erc20Token.isValid && (
              <p className="mt-1 text-xs text-green-700">
                {erc20Token.name} ({erc20Token.symbol})
              </p>
            )}
          </div>
        )}
      </div>

      {/* Time Choice */}
      <div>
        <label className="mb-3 block text-sm font-medium text-neutral-700">Auction timing</label>
        <div className="mb-4 space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={timeMode === "duration"}
              onChange={() => setTimeMode("duration")}
              className="h-4 w-4 border-neutral-300 text-neutral-900"
            />
            <span className="text-sm text-neutral-900">Begin on first bid</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={timeMode === "start_end"}
              onChange={() => setTimeMode("start_end")}
              className="h-4 w-4 border-neutral-300 text-neutral-900"
            />
            <span className="text-sm text-neutral-900">Start and end date</span>
          </label>
        </div>

        {timeMode === "duration" ? (
          <div>
            <label className="mb-2 block text-xs text-neutral-700">Duration (from first bid)</label>
            <DurationSelector
              value={durationSeconds}
              onChange={setDurationSeconds}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Start Time */}
            <DateSelector
              value={startTime}
              onChange={setStartTime}
              onValidationChange={(isValid, error) => {
                setStartTimeValid(isValid);
                setStartTimeError(error);
              }}
              min={getMinDateTime()}
              max={getMaxDateTime(10)}
              label="Start Time"
            />

            {/* End Time with Quick Options */}
            <div>
              <DateSelector
                value={endTime}
                onChange={setEndTime}
                onValidationChange={(isValid, error) => {
                  setEndTimeValid(isValid);
                  setEndTimeError(error);
                }}
                min={startTime ? getDateTimeAfterHours(startTime, 1) : getMinDateTime()}
                max={getMaxDateTime(10)}
                label="End Time"
                required
              />
              <div className="flex gap-2 flex-wrap mt-2">
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(24)}
                  className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  24hr
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(48)}
                  className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  48hr
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(24 * 7)}
                  className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  1wk
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(24 * 14)}
                  className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  2wk
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEndTime(24 * 30)}
                  className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  1mo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {allErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-800">Please fix the following:</p>
          <ul className="list-inside list-disc space-y-1 text-xs text-red-700">
            {allErrors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isFormValid}
          className="flex-1 rounded bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Creating auction…" : "Create auction"}
        </button>
      </div>
    </form>
  );
}

