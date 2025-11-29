"use client";

import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface JoinModalProps {
  onClose: () => void;
}

export function JoinModal({ onClose }: JoinModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle>Join Cryptoart.Social</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Browse for Free</h3>
            <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
              <li>View all auctions and collections</li>
              <li>Place bids on artwork</li>
              <li>Follow curators and artists</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">With Membership</h3>
            <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
              <li>Create your own auctions</li>
              <li>Cast in #cryptoart channel</li>
              <li>Earn referral commissions</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => {
                // User is already in the app, just close modal
                onClose();
              }}
              className="flex-1 max-w-none"
            >
              Continue Browsing
            </Button>
            <Button
              onClick={() => {
                window.location.href = "/studio";
              }}
              variant="outline"
              className="flex-1 max-w-none"
            >
              Go to Studio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

