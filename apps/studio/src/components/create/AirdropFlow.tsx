'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { ArtPreview } from '~/components/flows/ArtPreview';
import { FlowField, FlowShell, ReviewRow } from '~/components/flows/FlowShell';
import { TxStateBanner } from '~/components/flows/TxStateBanner';
import { ValidationList } from '~/components/flows/ValidationList';
import { WalletGate, WrongChainNotice } from '~/components/flows/WalletGate';
import type { FlowMode, PreviewScenario, TxPhase } from '~/components/flows/types';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import {
  AIRDROP_LIMITS,
  parseAirdrop1155,
  parseAirdrop721,
} from '~/lib/adapters/airdrop';
import { encodeAirdrop1155, encodeAirdrop721 } from '~/lib/adapters/such-collection';

const STEPS = ['Recipients', 'Review', 'Send'];

const SAMPLE_721 = `0x1111111111111111111111111111111111111111,ar://gift-0
0x2222222222222222222222222222222222222222,ar://gift-1
0x3333333333333333333333333333333333333333,ar://gift-2`;

const SAMPLE_1155 = `0x1111111111111111111111111111111111111111,1
0x2222222222222222222222222222222222222222,3
0x3333333333333333333333333333333333333333,1`;

export type AirdropFlowProps = {
  mode?: FlowMode;
  previewScenario?: PreviewScenario;
  collectionId: string;
  collectionName: string;
  collectionAddress: Address;
  chainId: number;
  tokenStandard?: 'erc721' | 'erc1155';
  previewImage?: string | null;
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

export function AirdropFlow({
  mode = 'live',
  previewScenario = 'default',
  collectionId,
  collectionName,
  collectionAddress,
  chainId: collectionChainId,
  tokenStandard = 'erc721',
  previewImage,
}: AirdropFlowProps) {
  const isPreview = mode === 'preview';
  const is1155 = tokenStandard === 'erc1155';
  const { isConnected, chainId } = useActiveWallet();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { isLoading: confirming, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [step, setStep] = useState(1);
  const [raw, setRaw] = useState(isPreview ? (is1155 ? SAMPLE_1155 : SAMPLE_721) : '');
  const [defaultUri, setDefaultUri] = useState(isPreview ? 'ar://shared' : '');
  const [tokenId1155, setTokenId1155] = useState('1');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sent, setSent] = useState(previewScenario === 'confirmed');

  const parsed = useMemo(() => {
    if (previewScenario === 'validation_error') {
      return {
        recipients: [],
        errors: ['Line 2: invalid address “not-an-address”.', 'Line 4: missing metadata URI.'],
        warnings: ['Line 3: duplicate address (kept).'],
      };
    }
    if (previewScenario === 'empty') {
      return { recipients: [], errors: [], warnings: [] };
    }
    return is1155 ? parseAirdrop1155(raw) : parseAirdrop721(raw, defaultUri);
  }, [raw, defaultUri, is1155, previewScenario]);

  const livePhase: TxPhase = (() => {
    if (!isConnected) return 'wallet_missing';
    if (chainId !== collectionChainId) return 'wrong_chain';
    if (localError?.toLowerCase().includes('insufficient')) return 'insufficient_funds';
    if (localError || isError) return 'failed';
    if (sent || isSuccess) return 'confirmed';
    if (busy || confirming) return txHash ? 'pending' : 'awaiting_signature';
    if (previewScenario === 'empty' && isPreview) return 'empty';
    return 'idle';
  })();
  const phase = isPreview ? phaseFromScenario(previewScenario) : livePhase;

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const text = await file.text();
      setRaw(text);
    },
    [],
  );

  const handleSend = useCallback(async () => {
    if (parsed.errors.length || parsed.recipients.length === 0) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (isPreview) {
        setSent(true);
        return;
      }
      if (is1155) {
        const recipients = parsed.recipients as ReturnType<typeof parseAirdrop1155>['recipients'];
        await sendTransactionAsync({
          to: collectionAddress,
          data: encodeAirdrop1155(
            recipients.map((r) => r.address),
            BigInt(tokenId1155 || '1'),
            recipients.map((r) => r.amount),
          ),
        });
      } else {
        const recipients = parsed.recipients as ReturnType<typeof parseAirdrop721>['recipients'];
        await sendTransactionAsync({
          to: collectionAddress,
          data: encodeAirdrop721(
            recipients.map((r) => r.address),
            recipients.map((r) => r.uri),
          ),
        });
      }
      setSent(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Airdrop failed');
    } finally {
      setBusy(false);
    }
  }, [
    parsed,
    isPreview,
    is1155,
    sendTransactionAsync,
    collectionAddress,
    tokenId1155,
  ]);

  if (phase === 'wallet_missing') {
    return (
      <FlowShell
        title="Airdrop"
        subtitle="Paste addresses or upload a CSV, review, then send."
        breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Airdrop' }}
        steps={STEPS}
        currentStep={step}
      >
        <WalletGate />
      </FlowShell>
    );
  }

  return (
    <FlowShell
      title="Airdrop"
      subtitle={`Up to ${AIRDROP_LIMITS.maxBatch} recipients per transaction. Blind config locks on airdrop if configured.`}
      breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Airdrop' }}
      steps={STEPS}
      currentStep={step}
      aside={
        <ArtPreview
          src={previewImage}
          caption={collectionName}
          subtitle={
            parsed.recipients.length
              ? `${parsed.recipients.length} recipient${parsed.recipients.length === 1 ? '' : 's'}`
              : 'No recipients yet'
          }
          aspectRatio="3 / 4"
        />
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
          {step < 3 ? (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={
                step === 1 &&
                (parsed.recipients.length === 0 || parsed.errors.length > 0)
              }
              onClick={() => setStep((s) => Math.min(3, s + 1))}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || sent || parsed.errors.length > 0 || parsed.recipients.length === 0}
              onClick={() => void handleSend()}
            >
              {sent ? 'Sent' : busy ? 'Sending…' : `Send airdrop (${parsed.recipients.length})`}
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
              ? 'Paste recipients or upload a CSV to begin.'
              : phase === 'confirmed'
                ? 'Airdrop submitted. Tokens will appear as the indexer catches up.'
                : undefined
        }
        className="mb-6"
      />

      {step === 1 && (
        <div className="space-y-6">
          <FlowField
            label={is1155 ? 'Recipients CSV' : 'Recipients'}
            hint={
              is1155
                ? 'Format: address,amount — one per line.'
                : 'Format: address,uri — or address alone with a default URI below.'
            }
          >
            <textarea
              className="studio-textarea min-h-[220px] font-mono text-sm"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={is1155 ? SAMPLE_1155 : SAMPLE_721}
            />
          </FlowField>
          <FlowField label="Or upload CSV">
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:text-foreground"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
          </FlowField>
          {!is1155 && (
            <FlowField label="Default URI" hint="Used when a line only has an address.">
              <input
                className="studio-input font-mono text-sm"
                value={defaultUri}
                onChange={(e) => setDefaultUri(e.target.value)}
                placeholder="ar://…"
              />
            </FlowField>
          )}
          {is1155 && (
            <FlowField label="Token ID">
              <input
                className="studio-input"
                value={tokenId1155}
                onChange={(e) => setTokenId1155(e.target.value)}
              />
            </FlowField>
          )}
          <ValidationList errors={parsed.errors} warnings={parsed.warnings} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <ValidationList errors={parsed.errors} warnings={parsed.warnings} />
          <ReviewRow label="Recipients" value={String(parsed.recipients.length)} />
          <ReviewRow label="Standard" value={is1155 ? 'ERC-1155' : 'ERC-721'} />
          {is1155 && <ReviewRow label="Token ID" value={tokenId1155} />}
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background-sunken">
                <tr>
                  <th className="px-4 py-2 font-medium text-muted">#</th>
                  <th className="px-4 py-2 font-medium text-muted">Address</th>
                  <th className="px-4 py-2 font-medium text-muted">{is1155 ? 'Amount' : 'URI'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.recipients.slice(0, 20).map((r, i) => (
                  <tr key={`${r.address}-${i}`}>
                    <td className="px-4 py-2 text-muted">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.address}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs">
                      {'uri' in r ? r.uri : String(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.recipients.length > 20 && (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                Showing 20 of {parsed.recipients.length}
              </p>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <p className="text-muted">
            This sends one owner transaction. If a blind mint is configured and not revealed, the airdrop locks that config.
          </p>
          <ReviewRow label="Recipients" value={String(parsed.recipients.length)} />
          <ReviewRow label="Collection" value={collectionAddress} />
        </div>
      )}
    </FlowShell>
  );
}
