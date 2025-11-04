"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui/Button";
import { SubscriberData } from "~/lib/csvExport";
import { Users, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { SubscriberModal } from "./SubscriberModal";

interface Subscription {
  object: string;
  provider_name: string;
  contract_address: string;
  chain: number;
  metadata: {
    title: string;
    symbol: string;
    art_url: string;
  };
  owner_address: string;
  price: {
    period_duration_seconds: number;
    tokens_per_period: string;
    initial_mint_price: string;
  };
  protocol_version: number;
  token: {
    symbol: string;
    address: string | null;
    decimals: number;
    erc20: boolean;
  };
  tiers?: Array<{
    id: string;
    price: {
      period_duration_seconds: number;
      tokens_per_period: string;
      initial_mint_price: string;
    };
  }>;
}

interface SubscriptionListProps {
  fid: number;
}

export function SubscriptionList({ fid }: SubscriptionListProps) {
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  // Fetch user's subscriptions
  const { 
    data: subscriptions, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['subscriptions', fid],
    queryFn: async () => {
      const response = await fetch(`/api/active-subscriptions?fid=${fid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }
      const data = await response.json();
      
      // Log the response structure for debugging
      console.log('API response:', data);
      
      // Ensure the response has the expected structure
      if (!data || typeof data !== 'object') {
        console.warn('Unexpected API response structure:', data);
        return { subscriptions: [] };
      }
      
      return data;
    },
    enabled: !!fid,
  });

  // Fetch subscribers for a specific subscription
  const fetchSubscribers = async (subscription: Subscription): Promise<SubscriberData[]> => {
    // Fetch subscribers filtered by the specific subscription contract
    const response = await fetch(`/api/active-subscribers?fid=${fid}&contractAddress=${subscription.contract_address}`);
    if (!response.ok) {
      throw new Error('Failed to fetch subscribers');
    }
    const data = await response.json();
    
    // Transform the API response to our SubscriberData format
    return (data.subscribers || []).map((subscriber: any) => ({
      fid: subscriber.user.fid,
      username: subscriber.user.username,
      displayName: subscriber.user.display_name,
      walletAddress: subscriber.user.verified_addresses?.primary?.eth_address,
      subscriptionDate: subscriber.subscribed_to?.[0]?.subscribed_at,
      isActive: new Date(subscriber.subscribed_to?.[0]?.expires_at) > new Date()
    }));
  };

  const handleViewSubscribers = async (subscription: Subscription) => {
    try {
      setLoadingSubscribers(true);
      setSelectedSubscription(subscription);
      
      console.log('Fetching subscribers for subscription:', subscription.metadata.title);
      console.log('Contract address:', subscription.contract_address);
      
      const subscriberData = await fetchSubscribers(subscription);
      
      console.log('Fetched subscribers count:', subscriberData.length);
      console.log('Sample subscriber:', subscriberData[0]);
      
      setSubscribers(subscriberData);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      alert('Failed to fetch subscribers. Please try again.');
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSubscription(null);
    setSubscribers([]);
  };

  const truncateAddress = (address: string | undefined) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load subscriptions</h3>
        <p className="text-gray-500 mb-4">There was an error loading your subscriptions.</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // Ensure subscriptionList is always an array
  const subscriptionList = Array.isArray(subscriptions?.subscriptions) 
    ? subscriptions.subscriptions 
    : [];

  if (subscriptionList.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No subscriptions found</h3>
        <p className="text-gray-500">You don&apos;t have any active Hypersub subscriptions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Subscriptions</h2>
          <p className="text-gray-600">Manage your Hypersub contracts and download subscriber data</p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subscriptionList && Array.isArray(subscriptionList) && subscriptionList.map((subscription: Subscription) => {
          return (
            <div 
              key={subscription.contract_address} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Subscription Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {subscription.metadata.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {subscription.metadata.symbol}
                  </p>
                </div>
                <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </div>
              </div>

              {/* Contract Address */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Contract Address
                </label>
                <div className="flex items-center space-x-2">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                    {truncateAddress(subscription.contract_address)}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(subscription.contract_address)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy full address"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {subscription.tiers ? subscription.tiers.length : 1}
                  </div>
                  <div className="text-sm text-gray-500">Tiers</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">
                    {subscription.token.symbol} • Chain {subscription.chain}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  onClick={() => handleViewSubscribers(subscription)}
                  disabled={loadingSubscribers}
                  className="w-full"
                  variant="outline"
                >
                  {loadingSubscribers ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      View Subscribers
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-gray-400 text-center">
                  View and copy subscriber data
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscriber Modal */}
      {selectedSubscription && (
        <SubscriberModal
          subscribers={subscribers}
          subscriptionName={selectedSubscription.metadata.title}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
