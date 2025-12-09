"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import Link from "next/link";
import { LayoutGrid, Table2, Plus, Package, Loader2 } from "lucide-react";
import { CreateCollectionModal } from "./CreateCollectionModal";

interface Collection {
  id: string;
  address: string;
  name: string | null;
  symbol: string | null;
  contractType: string;
  chainId: number;
  createdAt: string;
}

type ViewMode = "cards" | "table";

export function CollectionsList() {
  const { context } = useMiniApp();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    async function fetchCollections() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/studio/contracts");
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Response is not JSON");
        }
        
        const data = await response.json();
        if (data.success) {
          setCollections(data.collections || []);
        } else {
          // If API returns success:false, still show empty state
          setCollections([]);
        }
      } catch (err) {
        // On error, show empty state instead of error message
        console.error("Error fetching collections:", err);
        setCollections([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCollections();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Collection
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`p-2 rounded ${
              viewMode === "cards"
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded ${
              viewMode === "table"
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showCreateModal && (
        <CreateCollectionModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {collections.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No collections yet
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Create your first collection to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Collection
          </button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/studio/collections/${collection.address}`}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {collection.name || "Unnamed Collection"}
                  </h3>
                  {collection.symbol && (
                    <p className="text-sm text-gray-600 mb-2">{collection.symbol}</p>
                  )}
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                    {collection.contractType}
                  </span>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 ml-2" />
              </div>
              <p className="text-xs text-gray-500 font-mono truncate">
                {collection.address}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Symbol
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Chain
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {collections.map((collection) => (
                <tr
                  key={collection.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    window.location.href = `/studio/collections/${collection.address}`;
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {collection.name || "Unnamed Collection"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {collection.symbol || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      {collection.contractType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {collection.address.slice(0, 10)}...
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {collection.chainId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

