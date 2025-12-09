"use client";

import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { convertSubscribersToCSV, copyCSVToClipboard, SubscriberData } from "~/lib/csvExport";
import { Copy, X, Users, Check } from "lucide-react";

interface SubscriberModalProps {
  subscribers: SubscriberData[];
  subscriptionName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriberModal({ subscribers, subscriptionName, isOpen, onClose }: SubscriberModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCSV = async () => {
    try {
      const csvContent = convertSubscribersToCSV(subscribers);
      await copyCSVToClipboard(csvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying CSV:', error);
      alert('Failed to copy CSV. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {subscriptionName} Subscribers
              </h2>
              <p className="text-sm text-gray-500">
                {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleCopyCSV}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy CSV</span>
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(90vh-120px)]">
          {subscribers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No subscribers found</h3>
                <p className="text-gray-500">This subscription doesn&apos;t have any subscribers yet.</p>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        FID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Display Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wallet Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subscription Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subscribers.map((subscriber, index) => (
                      <tr key={subscriber.fid || index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {subscriber.fid}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          @{subscriber.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {subscriber.displayName || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {subscriber.walletAddress ? 
                            `${subscriber.walletAddress.slice(0, 6)}...${subscriber.walletAddress.slice(-4)}` : 
                            '-'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {subscriber.subscriptionDate ? 
                            new Date(subscriber.subscriptionDate).toLocaleDateString() : 
                            '-'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            subscriber.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {subscriber.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {subscribers.map((subscriber, index) => (
                  <div key={subscriber.fid || index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">@{subscriber.username}</h3>
                        {subscriber.displayName && (
                          <p className="text-sm text-gray-600">{subscriber.displayName}</p>
                        )}
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        subscriber.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {subscriber.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div><span className="font-medium">FID:</span> {subscriber.fid}</div>
                      {subscriber.walletAddress && (
                        <div>
                          <span className="font-medium">Wallet:</span> 
                          <span className="font-mono ml-1">
                            {subscriber.walletAddress.slice(0, 6)}...{subscriber.walletAddress.slice(-4)}
                          </span>
                        </div>
                      )}
                      {subscriber.subscriptionDate && (
                        <div>
                          <span className="font-medium">Subscribed:</span> 
                          <span className="ml-1">
                            {new Date(subscriber.subscriptionDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
