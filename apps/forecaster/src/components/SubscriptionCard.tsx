"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TierInfo } from "@/lib/types";
import { formatEther, formatTimeRemaining } from "@/lib/utils";
import { Users, Clock, Gift, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SubscriptionCardProps {
  contractAddress: string;
  contractName: string;
  tier: TierInfo;
  onSubscribe?: () => void;
}

export function SubscriptionCard({
  contractAddress,
  contractName,
  tier,
  onSubscribe,
}: SubscriptionCardProps) {
  const periodDays = Math.floor(tier.periodDurationSeconds / 86400);
  const rewardPercent = tier.rewardBasisPoints / 100;
  const availableSpots = tier.maxSupply - tier.currentSupply;
  const isAvailable = availableSpots > 0 && !tier.paused;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{contractName}</span>
          {tier.tierId > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              Tier {tier.tierId}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {formatEther(tier.pricePerPeriod)} ETH / {periodDays} days
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="w-4 h-4 mr-2" />
            <span>{periodDays} day subscription period</span>
          </div>

          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="w-4 h-4 mr-2" />
            <span>
              {availableSpots} / {tier.maxSupply} spots available
            </span>
          </div>

          {tier.rewardBasisPoints > 0 && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Gift className="w-4 h-4 mr-2" />
              <span>{rewardPercent}% rewards share</span>
            </div>
          )}
        </div>

        {!isAvailable && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {tier.paused ? "⏸️ Paused" : "🔒 Sold Out"}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        {onSubscribe ? (
          <Button
            onClick={onSubscribe}
            disabled={!isAvailable}
            className="w-full"
          >
            Subscribe Now <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Link href={`/subscribe/${contractAddress}?tier=${tier.tierId}`} className="w-full">
            <Button disabled={!isAvailable} className="w-full">
              Subscribe Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
