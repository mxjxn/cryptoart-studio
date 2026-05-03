"use client";

import { useState, useEffect, useMemo } from "react";
import { useERC20Token } from "~/hooks/useERC20Token";
import { NumberSelector } from "./NumberSelector";
import { DateSelector, getMinDateTime, getMaxDateTime, getDateTimeAfterHours } from "./DateSelector";

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
  const [price, setPrice] = useState("0.1"); // Sensible default
  const [quantity, setQuantity] = useState("1");
  const [paymentType, setPaymentType] = useState<"ETH" | "ERC20">("ETH");
  const [erc20Address, setErc20Address] = useState("");
  const [useTimeframe, setUseTimeframe] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  
  // Validation state
  const [priceValid, setPriceValid] = useState(true);
  const [priceError, setPriceError] = useState<string | undefined>();
  const [quantityValid, setQuantityValid] = useState(true);
  const [quantityError, setQuantityError] = useState<string | undefined>();
  const [startTimeValid, setStartTimeValid] = useState(true);
  const [startTimeError, setStartTimeError] = useState<string | undefined>();
  const [endTimeValid, setEndTimeValid] = useState(true);
  const [endTimeError, setEndTimeError] = useState<string | undefined>();

  // Auto-fill start time with current date/time when switching to timeframe mode
  // Clear times when switching to no timeframe mode
  useEffect(() => {
    if (useTimeframe && !startTime) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setStartTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else if (!useTimeframe) {
      // Clear times when switching to no timeframe
      setStartTime("");
      setEndTime("");
    }
  }, [useTimeframe]);

  const erc20Token = useERC20Token(paymentType === "ERC20" ? erc20Address : undefined);
  const isValidERC20 = paymentType === "ETH" || (paymentType === "ERC20" && erc20Token.isValid);
  const priceSymbol = paymentType === "ETH" ? "ETH" : (erc20Token.symbol || "TOKEN");

  // Overall form validation
  const isFormValid = useMemo(() => {
    if (!priceValid) return false;
    if (!quantityValid) return false;
    if (!isValidERC20) return false;
    if (useTimeframe) {
      if (!startTimeValid || !endTimeValid) return false;
      if (!startTime || !endTime) return false;
    }
    return true;
  }, [priceValid, quantityValid, isValidERC20, useTimeframe, startTimeValid, endTimeValid, startTime, endTime]);

  // Collect all errors
  const allErrors = useMemo(() => {
    const errors: string[] = [];
    if (!priceValid && priceError) errors.push(`Price: ${priceError}`);
    if (!quantityValid && quantityError) errors.push(`Quantity: ${quantityError}`);
    if (!isValidERC20 && paymentType === "ERC20") {
      errors.push("ERC20 Address: Please enter a valid ERC20 token address");
    }
    if (useTimeframe) {
      if (!startTimeValid && startTimeError) errors.push(`Start Time: ${startTimeError}`);
      if (!endTimeValid && endTimeError) errors.push(`End Time: ${endTimeError}`);
    }
    return errors;
  }, [priceValid, priceError, quantityValid, quantityError, isValidERC20, paymentType, useTimeframe, startTimeValid, startTimeError, endTimeValid, endTimeError]);

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

    const quantityNum = parseInt(quantity);
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
    <form onSubmit={handleSubmit} className="space-y-6 font-space-grotesk">
      <div>
        <h2 className="mb-2 text-xl font-medium text-neutral-900">ERC1155 fixed price</h2>
        <p className="mb-4 text-sm text-neutral-600">Configure your edition listing (fixed price only).</p>
      </div>

      {/* Quantity Selector */}
      <NumberSelector
        value={quantity}
        onChange={setQuantity}
        onValidationChange={(isValid, error) => {
          setQuantityValid(isValid);
          setQuantityError(error);
        }}
        min={1}
        max={balance}
        step={1}
        label={`Quantity (you have ${balance} available)`}
        required
      />

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

      {/* Price Input */}
      <NumberSelector
        value={price}
        onChange={setPrice}
        onValidationChange={(isValid, error) => {
          setPriceValid(isValid);
          setPriceError(error);
        }}
        min={0.001}
        step={0.001}
        label={`Price Per Copy (${priceSymbol})`}
        placeholder="0.1"
        required
      />

      {/* Timeframe Options */}
      <div>
        <label className="mb-3 block text-sm font-medium text-neutral-700">Timeframe</label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={useTimeframe}
              onChange={() => setUseTimeframe(true)}
              className="h-4 w-4 border-neutral-300 text-neutral-900"
            />
            <span className="text-sm text-neutral-900">Start and end date</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!useTimeframe}
              onChange={() => setUseTimeframe(false)}
              className="h-4 w-4 border-neutral-300 text-neutral-900"
            />
            <div>
              <span className="text-sm text-neutral-900">No timeframe — open until sold out</span>
              <p className="mt-0.5 text-xs text-neutral-600">
                Listing starts immediately and remains active for ~10 years or until all copies are sold.
              </p>
            </div>
          </label>
        </div>

        {useTimeframe && (
          <div className="mt-4 space-y-4">
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
          {isSubmitting ? "Creating listing…" : "Create listing"}
        </button>
      </div>
    </form>
  );
}

