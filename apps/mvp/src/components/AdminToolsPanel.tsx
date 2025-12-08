"use client";

import { useAdminMode } from "~/hooks/useAdminMode";
import { TransitionLink } from "~/components/TransitionLink";
import { useState } from "react";

const ADMIN_LINKS = [
  { name: "Featured", href: "/admin/featured" },
  { name: "Users", href: "/admin/users" },
  { name: "Membership", href: "/admin/membership" },
  { name: "Stats", href: "/admin/stats" },
  { name: "Errors", href: "/admin/errors" },
  { name: "Notifications", href: "/admin/notifications" },
];

export function AdminToolsPanel() {
  const { isAdminModeEnabled, isAdmin } = useAdminMode();
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show if admin mode is enabled and user is admin
  if (!isAdmin || !isAdminModeEnabled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExpanded ? (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg shadow-lg p-4 min-w-[200px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Admin Tools</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-[#999999] hover:text-white transition-colors"
              aria-label="Collapse admin tools"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="space-y-1">
            {ADMIN_LINKS.map((link) => (
              <TransitionLink
                key={link.href}
                href={link.href}
                className="block px-3 py-2 text-sm text-[#cccccc] hover:text-white hover:bg-[#333333] rounded transition-colors"
              >
                {link.name}
              </TransitionLink>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg transition-colors"
          aria-label="Open admin tools"
          title="Admin Tools"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}


