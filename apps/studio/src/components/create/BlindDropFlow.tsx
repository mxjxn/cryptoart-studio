'use client';

import { useCallback, useMemo, useState } from 'react';
import { encodePacked, keccak256, toHex, type Address, type Hex } from 'viem';
import { useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { ArtPreview } from '~/components/flows/ArtPreview';
import { FlowField, FlowShell, ReviewRow } from '~/components/flows/FlowShell';
import { TxStateBanner } from '~/components/flows/TxStateBanner';
import { ValidationList } from '~/components/flows/ValidationList';
import { WalletGate, WrongChainNotice } from '~/components/flows/WalletGate';
import type { FlowMode, PreviewScenario, TxPhase } from '~/components/flows/types';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import {
  encodeReveal,
  encodeSetBlindMintConfig,
  encodeSetTokenURI,
  ensureTrailingSlash,
} from '~/lib/adapters/such-collection';

const STEPS = ['Placeholder', 'Commit', 'Reveal', 'Fix'];

export type BlindDropFlowProps = {
  mode?: FlowMode;
  previewScenario?: PreviewScenario;
  collectionId: string;
  collectionName: string;
  collectionAddress: Address;
  chainId: number;
  previewImage?: string | null;
  initiallyLocked?: boolean;
  initiallyRevealed?: boolean;
};

function phaseFromScenario(scenario?: PreviewScenario): TxPhase {
  switch (scenario) {
    case 'wallet_missing':
      return 'wallet_missing';
    case 'wrong_chain':
      return 'wrong_chain';
    case 'pending':
      return 'pending';
    case 'confirmed':
      return 'confirmed';
    case 'failed':
      return 'failed';
    case 'insufficient_funds':
      return 'insufficient_funds';
    case 'validation_error':
      return 'validating';
    case 'empty':
      return 'empty';
    default:
      return 'idle';
  }
}

function randomSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

export function BlindDropFlow({
  mode = 'live',
  previewScenario = 'default',
  collectionId,
  collectionName,
  collectionAddress,
  chainId: collectionChainId,
  previewImage,
  initiallyLocked = false,
  initiallyRevealed = false,
}: BlindDropFlowProps) {
  const isPreview = mode === 'preview';
  const { isConnected, chainId } = useActiveWallet();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { isLoading: confirming, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const locked =
    previewScenario === 'locked' || initiallyLocked || (isPreview && previewScenario === 'default' && false);
  const revealed =
    previewScenario === 'revealed' || initiallyRevealed || (isPreview && previewScenario === 'confirmed');

  const [step, setStep] = useState(() => {
    if (previewScenario === 'revealed' || initiallyRevealed) return 4;
    if (previewScenario === 'locked') return 2;
    return 1;
  });
  const [placeholderURI, setPlaceholderURI] = useState(
    isPreview ? 'ar://placeholder-blind-art' : '',
  );
  const [revealDate, setRevealDate] = useState(
    isPreview ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16) : '',
  );
  const [revealedBaseURI, setRevealedBaseURI] = useState(
    isPreview ? 'ar://final-manifest/' : '',
  );
  const [salt, setSalt] = useState<Hex>(isPreview ? ('0x' + '11'.repeat(32)) as Hex : randomSalt());
  const [configured, setConfigured] = useState(isPreview && previewScenario !== 'empty');
  const [isRevealed, setIsRevealed] = useState(revealed);
  const [isLocked, setIsLocked] = useState(locked);
  const [fixTokenId, setFixTokenId] = useState('1');
  const [fixURI, setFixURI] = useState(isPreview ? 'ar://fixed-token-1' : '');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const commitment = useMemo(() => {
    if (!revealedBaseURI.trim()) return null;
    return keccak256(
      encodePacked(['string', 'bytes32'], [ensureTrailingSlash(revealedBaseURI.trim()), salt]),
    );
  }, [revealedBaseURI, salt]);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (previewScenario === 'validation_error') {
      errs.push('Placeholder art URI is required.');
      errs.push('Revealed base URI must end with /.');
      return errs;
    }
    if (step === 1 && !placeholderURI.trim()) errs.push('Placeholder art URI is required.');
    if (step === 2) {
      if (!revealedBaseURI.trim()) errs.push('Revealed base URI is required to commit.');
      else if (!revealedBaseURI.trim().endsWith('/')) {
        errs.push('Revealed base URI must end with a trailing slash.');
      }
    }
    if (step === 3 && !isRevealed) {
      if (!revealedBaseURI.trim().endsWith('/')) {
        errs.push('Revealed base URI must end with a trailing slash.');
      }
    }
    if (step === 4) {
      if (!fixTokenId.trim()) errs.push('Token ID is required.');
      if (!fixURI.trim()) errs.push('Replacement metadata URI is required.');
    }
    return errs;
  }, [step, placeholderURI, revealedBaseURI, fixTokenId, fixURI, previewScenario, isRevealed]);

  const livePhase: TxPhase = (() => {
    if (!isConnected) return 'wallet_missing';
    if (chainId !== collectionChainId) return 'wrong_chain';
    if (localError?.toLowerCase().includes('insufficient')) return 'insufficient_funds';
    if (localError || isError) return 'failed';
    if (isSuccess) return 'confirmed';
    if (busy || confirming) return txHash ? 'pending' : 'awaiting_signature';
    if (previewScenario === 'empty' && isPreview) return 'empty';
    return 'idle';
  })();

  const phase = isPreview ? phaseFromScenario(previewScenario) : livePhase;

  const runTx = useCallback(
    async (data: `0x${string}`, onOk: () => void) => {
      setBusy(true);
      setLocalError(null);
      try {
        if (isPreview) {
          onOk();
          return;
        }
        await sendTransactionAsync({ to: collectionAddress, data });
        onOk();
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Transaction failed');
      } finally {
        setBusy(false);
      }
    },
    [isPreview, sendTransactionAsync, collectionAddress],
  );

  const handleCommit = useCallback(async () => {
    if (!commitment || validationErrors.length) return;
    if (isLocked) {
      setLocalError('Blind config is locked after the first mint, delivery, or airdrop.');
      return;
    }
    await runTx(encodeSetBlindMintConfig(placeholderURI, commitment), () => {
      setConfigured(true);
      setStep(3);
    });
  }, [commitment, validationErrors, isLocked, runTx, placeholderURI]);

  const handleReveal = useCallback(async () => {
    if (validationErrors.length) return;
    await runTx(encodeReveal(revealedBaseURI, salt), () => {
      setIsRevealed(true);
      setStep(4);
    });
  }, [validationErrors, runTx, revealedBaseURI, salt]);

  const handleFix = useCallback(async () => {
    if (validationErrors.length) return;
    await runTx(encodeSetTokenURI(BigInt(fixTokenId), fixURI), () => {
      /* ok */
    });
  }, [validationErrors, runTx, fixTokenId, fixURI]);

  if (phase === 'wallet_missing') {
    return (
      <FlowShell
        title="Blind drop"
        subtitle="Placeholder art now. Commit, then reveal when you’re ready."
        breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Blind drop' }}
        steps={STEPS}
        currentStep={step}
      >
        <WalletGate />
      </FlowShell>
    );
  }

  return (
    <FlowShell
      title="Blind drop"
      subtitle="Config locks on the first mint, delivery, or airdrop. After reveal you can still fix individual token metadata."
      breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Blind drop' }}
      steps={STEPS}
      currentStep={step}
      aside={
        <div className="space-y-4">
          <ArtPreview
            src={previewImage}
            caption={isRevealed ? 'Revealed' : 'Placeholder'}
            subtitle={isLocked ? 'Config locked' : configured ? 'Committed' : 'Not configured'}
            aspectRatio="1 / 1"
          />
          {(isLocked || previewScenario === 'locked') && (
            <div className="rounded-md border border-warning/30 bg-warning-faint px-4 py-3 text-sm text-warning">
              Blind config is locked. You can still reveal (if not already) and fix metadata after reveal.
            </div>
          )}
        </div>
      }
      footer={
        <>
          <button
            type="button"
            className={step === 1 ? 'invisible' : 'text-[15px] text-muted hover:text-foreground'}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            ← Back
          </button>
          {step === 1 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={validationErrors.length > 0}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || validationErrors.length > 0 || isLocked}
              onClick={() => void handleCommit()}
            >
              {busy ? 'Committing…' : 'Commit blind config'}
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || isRevealed || validationErrors.length > 0}
              onClick={() => void handleReveal()}
            >
              {isRevealed ? 'Revealed' : busy ? 'Revealing…' : 'Reveal'}
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || !isRevealed || validationErrors.length > 0}
              onClick={() => void handleFix()}
            >
              {busy ? 'Updating…' : 'Fix token metadata'}
            </button>
          )}
        </>
      }
    >
      {phase === 'wrong_chain' && (
        <WrongChainNotice
          currentChainId={chainId}
          expectedChainId={collectionChainId}
          onSwitch={() => void switchChainAsync?.({ chainId: collectionChainId })}
          className="mb-6"
        />
      )}

      <TxStateBanner
        phase={phase}
        message={
          phase === 'failed'
            ? localError || error?.message
            : phase === 'empty'
              ? 'No blind mint configured for this collection yet.'
              : undefined
        }
        className="mb-6"
      />
      <ValidationList errors={validationErrors} className="mb-6" />

      {step === 1 && (
        <div className="space-y-6">
          <FlowField label="Placeholder art URI" hint="Shown for every token until reveal.">
            <input
              className="studio-input font-mono text-sm"
              value={placeholderURI}
              onChange={(e) => setPlaceholderURI(e.target.value)}
              placeholder="ar://…"
            />
          </FlowField>
          <FlowField label="Planned reveal date" hint="Informational only — reveal is a manual owner transaction.">
            <input
              type="datetime-local"
              className="studio-input"
              value={revealDate}
              onChange={(e) => setRevealDate(e.target.value)}
            />
          </FlowField>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <FlowField
            label="Final base URI"
            hint="Hashed with a salt into the on-chain commitment. Must end with /."
          >
            <input
              className="studio-input font-mono text-sm"
              value={revealedBaseURI}
              onChange={(e) => setRevealedBaseURI(e.target.value)}
              placeholder="ar://final-manifest/"
            />
          </FlowField>
          <FlowField label="Salt" hint="Store this safely — you need it to reveal.">
            <div className="flex gap-2">
              <input className="studio-input font-mono text-xs" value={salt} readOnly />
              <button
                type="button"
                className="studio-btn-outline shrink-0 px-4"
                onClick={() => setSalt(randomSalt())}
                disabled={configured || isLocked}
              >
                New
              </button>
            </div>
          </FlowField>
          <ReviewRow label="Commitment" value={<span className="break-all font-mono text-xs">{commitment ?? '—'}</span>} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <p className="text-muted">
            Reveal verifies <code className="rounded bg-background-sunken px-1.5 py-0.5 text-sm">keccak256(baseURI, salt)</code>{' '}
            against the stored commitment, then unlocks real metadata.
          </p>
          <ReviewRow label="Placeholder" value={placeholderURI || '—'} />
          <ReviewRow label="Reveal URI" value={revealedBaseURI || '—'} />
          <ReviewRow label="Status" value={isRevealed ? 'Revealed' : 'Hidden'} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          {!isRevealed && (
            <p className="text-sm text-warning">Reveal the drop before fixing per-token metadata.</p>
          )}
          <FlowField label="Token ID">
            <input
              className="studio-input"
              value={fixTokenId}
              onChange={(e) => setFixTokenId(e.target.value)}
              inputMode="numeric"
            />
          </FlowField>
          <FlowField label="New metadata URI">
            <input
              className="studio-input font-mono text-sm"
              value={fixURI}
              onChange={(e) => setFixURI(e.target.value)}
              placeholder="ar://…"
            />
          </FlowField>
        </div>
      )}
    </FlowShell>
  );
}
