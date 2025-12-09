"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import { ListingLoadingOverlay } from "~/components/ListingLoadingOverlay";

interface LoadingOverlayState {
  listingId: string | null;
  auction: EnrichedAuctionData | null;
  gradient: string;
  cardElement: HTMLElement | null;
}

interface LoadingOverlayContextType {
  showOverlay: (
    listingId: string,
    auction: EnrichedAuctionData,
    gradient: string,
    cardElement: HTMLElement
  ) => void;
  hideOverlay: () => void;
  isVisible: boolean;
}

const LoadingOverlayContext = createContext<LoadingOverlayContextType | undefined>(undefined);

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadingOverlayState>({
    listingId: null,
    auction: null,
    gradient: "",
    cardElement: null,
  });

  const showOverlay = useCallback(
    (
      listingId: string,
      auction: EnrichedAuctionData,
      gradient: string,
      cardElement: HTMLElement
    ) => {
      setState({
        listingId,
        auction,
        gradient,
        cardElement,
      });
    },
    []
  );

  const hideOverlay = useCallback(() => {
    setState({
      listingId: null,
      auction: null,
      gradient: "",
      cardElement: null,
    });
  }, []);

  return (
    <LoadingOverlayContext.Provider
      value={{
        showOverlay,
        hideOverlay,
        isVisible: state.listingId !== null,
      }}
    >
      {children}
      {state.listingId && state.auction && state.cardElement && (
        <ListingLoadingOverlay
          auction={state.auction}
          gradient={state.gradient}
          cardElement={state.cardElement}
        />
      )}
    </LoadingOverlayContext.Provider>
  );
}

export function useLoadingOverlay() {
  const context = useContext(LoadingOverlayContext);
  if (context === undefined) {
    throw new Error("useLoadingOverlay must be used within a LoadingOverlayProvider");
  }
  return context;
}





