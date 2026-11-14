'use client';

import { useCallback, useMemo, useState } from 'react';
import { encodePacked, keccak256, toHex, type Address, type Hex } from 'viem';
import { useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { ArtPreview } from '~/components/flows/ArtPreview';
import { FlowDetails, FlowField, FlowShell, ReviewRow } from '~/components/flows/FlowShell';
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
  previewAspectRatio?: string;
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
  previewAspectRatio = '1 / 1',
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

  const locked = previewScenario === 'locked' || initiallyLocked;
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
    isPreview ? 'ar://final-manifest' : '',
  );
  const [salt, setSalt] = useState<Hex>(isPreview ? (('0x' + '11'.repeat(32)) as Hex) : randomSalt());
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
      encodePacked(
        ['string', 'bytes32'],
        [ensureTrailingSlash(revealedBaseURI.trim()), salt],
      ),
    );
  }, [revealedBaseURI, salt]);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (previewScenario === 'validation_error') {
      errs.push('Add a placeholder image link.');
      errs.push('Add the final artwork folder link before you commit.');
      return errs;
    }
    if (step === 1 && !placeholderURI.trim()) errs.push('Add a placeholder image link.');
    if (step === 2 && !revealedBaseURI.trim()) {
      errs.push('Add the final artwork folder link before you commit.');
    }
    if (step === 4) {
      if (!fixTokenId.trim()) errs.push('Enter a token number.');
      if (!fixURI.trim()) errs.push('Add the corrected artwork link.');
    }
    return errs;
  }, [step, placeholderURI, revealedBaseURI, fixTokenId, fixURI, previewScenario]);

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
      setLocalError('This blind drop is locked after the first mint, delivery, or airdrop.');
      return;
    }
    await runTx(encodeSetBlindMintConfig(placeholderURI, commitment), () => {
      setConfigured(true);
      setStep(3);
    });
  }, [commitment, validationErrors, isLocked, runTx, placeholderURI]);

  const handleReveal = useCallback(async () => {
    if (validationErrors.length) return;
    await runTx(encodeReveal(ensureTrailingSlash(revealedBaseURI.trim()), salt), () => {
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
        subtitle="Show a shared placeholder for now. Reveal the real artwork when you’re ready — all in Studio."
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
      subtitle="Collectors see a placeholder until you reveal. After the first mint, delivery, or airdrop, the setup locks — you can still reveal and fix individual pieces."
      breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Blind drop' }}
      steps={STEPS}
      currentStep={step}
      aside={
        <div className="space-y-4">
          <ArtPreview
            src={previewScenario === 'empty' ? null : previewImage}
            aspectRatio={previewAspectRatio}
            caption={isRevealed ? 'Revealed' : previewScenario === 'empty' ? undefined : 'Placeholder'}
            subtitle={
              previewScenario === 'empty'
                ? undefined
                : isLocked
                  ? 'Config locked'
                  : configured
                    ? 'Committed'
                    : 'Not configured'
            }
            emptyTitle="No placeholder yet"
            emptyHint="Add placeholder art and it will appear here."
          />
          {(isLocked || previewScenario === 'locked') && (
            <div className="rounded-md border border-warning/30 bg-warning-faint px-4 py-3 text-sm text-warning">
              This blind drop is locked. You can still reveal (if you haven’t) and fix individual pieces afterward.
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
              {busy ? 'Saving…' : 'Commit blind setup'}
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || isRevealed || validationErrors.length > 0}
              onClick={() => void handleReveal()}
            >
              {isRevealed ? 'Revealed' : busy ? 'Revealing…' : 'Reveal artwork'}
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || !isRevealed || validationErrors.length > 0}
              onClick={() => void handleFix()}
            >
              {busy ? 'Updating…' : 'Fix this piece'}
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
              ? 'No blind drop set up for this collection yet.'
              : undefined
        }
        className="mb-6"
      />
      <ValidationList errors={validationErrors} className="mb-6" />

      {step === 1 && (
        <div className="space-y-6">
          <FlowField label="Placeholder art" hint="Everyone sees this until you reveal.">
            <input
              className="studio-input font-mono text-sm"
              value={placeholderURI}
              onChange={(e) => setPlaceholderURI(e.target.value)}
              placeholder="ar://…"
            />
          </FlowField>
          <FlowField
            label="Planned reveal date"
            hint="Just for your notes — revealing is a button you press when you’re ready."
          >
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
            label="Final artwork folder"
            hint="We’ll seal a commitment to this so collectors can trust the reveal."
          >
            <input
              className="studio-input font-mono text-sm"
              value={revealedBaseURI}
              onChange={(e) => setRevealedBaseURI(e.target.value)}
              placeholder="ar://final-manifest"
            />
          </FlowField>
          <FlowField label="Secret salt" hint="Keep this safe — you’ll need it to reveal.">
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
          <ReviewRow
            label="Commitment"
            value={<span className="break-all font-mono text-xs">{commitment ?? '—'}</span>}
          />
          <FlowDetails>
            <p>
              We seal a commitment to your final folder and salt so collectors can trust the reveal. Blind setup, reveal, and fixes all happen in Studio.
            </p>
          </FlowDetails>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <p className="text-muted">
            Reveal unlocks the real artwork for everyone who holds a piece. Make sure your salt still matches.
          </p>
          <ReviewRow label="Placeholder" value={placeholderURI || '—'} />
          <ReviewRow label="Final folder" value={revealedBaseURI || '—'} />
          <ReviewRow label="Status" value={isRevealed ? 'Revealed' : 'Still hidden'} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          {!isRevealed && (
            <p className="text-sm text-warning">Reveal the drop before fixing individual pieces.</p>
          )}
          <FlowField label="Token number">
            <input
              className="studio-input"
              value={fixTokenId}
              onChange={(e) => setFixTokenId(e.target.value)}
              inputMode="numeric"
            />
          </FlowField>
          <FlowField label="Corrected artwork link">
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
