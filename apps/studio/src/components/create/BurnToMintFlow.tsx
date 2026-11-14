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
  BurnTokenSpec,
  encodeCreateBurnConfig,
  encodeDeployBurnToMint,
  getBurnToMintBytecode,
  validateBurnConfigForm,
} from '~/lib/adapters/burn-to-mint';
import { encodeRegisterExtension } from '~/lib/adapters/such-collection';

const STEPS = ['Deploy', 'Register', 'Configure'];

export type BurnToMintFlowProps = {
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

export function BurnToMintFlow({
  mode = 'live',
  previewScenario = 'default',
  collectionId,
  collectionName,
  collectionAddress,
  chainId: collectionChainId,
  tokenStandard = 'erc721',
  previewImage,
}: BurnToMintFlowProps) {
  const isPreview = mode === 'preview';
  const { address, isConnected, chainId } = useActiveWallet();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { isLoading: confirming, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const bytecodeAvailable = Boolean(getBurnToMintBytecode()) || isPreview;

  const [step, setStep] = useState(1);
  const [extensionAddress, setExtensionAddress] = useState<string>(
    isPreview ? '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb' : '',
  );
  const [sourceContract, setSourceContract] = useState(
    isPreview ? '0x1111111111111111111111111111111111111111' : '',
  );
  const [sourceSpec, setSourceSpec] = useState<0 | 1>(BurnTokenSpec.ERC721);
  const [burnRatio, setBurnRatio] = useState('1');
  const [mintRatio, setMintRatio] = useState('1');
  const [totalCap, setTotalCap] = useState('0');
  const [perWalletCap, setPerWalletCap] = useState('0');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [targetBaseURI, setTargetBaseURI] = useState(isPreview ? 'ar://burn-redeem/' : '');
  const [targetTokenId, setTargetTokenId] = useState('1');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [stubReason, setStubReason] = useState<string | null>(
    !bytecodeAvailable && !isPreview
      ? 'BurnToMintExtension bytecode is not on this branch until PR 200 merges.'
      : null,
  );
  const [done, setDone] = useState(previewScenario === 'confirmed');

  const targetSpec =
    tokenStandard === 'erc1155' ? BurnTokenSpec.ERC1155 : BurnTokenSpec.ERC721;

  const validationErrors = useMemo(() => {
    if (previewScenario === 'validation_error') {
      return ['Source contract must be a valid address.', 'Target base URI must end with a trailing slash.'];
    }
    if (step !== 3) return [];
    return validateBurnConfigForm({
      sourceContract,
      targetBaseURI,
      burnRatio: Number(burnRatio),
      mintRatio: Number(mintRatio),
      targetSpec,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    });
  }, [
    previewScenario,
    step,
    sourceContract,
    targetBaseURI,
    burnRatio,
    mintRatio,
    targetSpec,
    startTime,
    endTime,
  ]);

  const livePhase: TxPhase = (() => {
    if (!isConnected) return 'wallet_missing';
    if (chainId !== collectionChainId) return 'wrong_chain';
    if (localError?.toLowerCase().includes('insufficient')) return 'insufficient_funds';
    if (localError || isError) return 'failed';
    if (done || isSuccess) return 'confirmed';
    if (busy || confirming) return txHash ? 'pending' : 'awaiting_signature';
    if (previewScenario === 'empty' && isPreview) return 'empty';
    return 'idle';
  })();
  const phase = isPreview ? phaseFromScenario(previewScenario) : livePhase;

  const handleDeploy = useCallback(async () => {
    if (!address && !isPreview) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (isPreview) {
        setExtensionAddress('0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb');
        setStep(2);
        return;
      }
      const encoded = encodeDeployBurnToMint(address!);
      if ('stub' in encoded) {
        setStubReason(encoded.reason);
        return;
      }
      await sendTransactionAsync({ data: encoded.data });
      setStep(2);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setBusy(false);
    }
  }, [address, isPreview, sendTransactionAsync]);

  const handleRegister = useCallback(async () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(extensionAddress)) {
      setLocalError('Paste the deployed extension address first.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      if (isPreview) {
        setStep(3);
        return;
      }
      await sendTransactionAsync({
        to: collectionAddress,
        data: encodeRegisterExtension(extensionAddress as Address, targetBaseURI || 'ar://'),
      });
      setStep(3);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Register failed');
    } finally {
      setBusy(false);
    }
  }, [extensionAddress, isPreview, sendTransactionAsync, collectionAddress, targetBaseURI]);

  const handleConfigure = useCallback(async () => {
    if (validationErrors.length) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(extensionAddress)) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (isPreview) {
        setDone(true);
        return;
      }
      const start = startTime ? Math.floor(Date.parse(startTime) / 1000) : 0;
      const end = endTime ? Math.floor(Date.parse(endTime) / 1000) : 0;
      await sendTransactionAsync({
        to: extensionAddress as Address,
        data: encodeCreateBurnConfig({
          sourceContract: sourceContract as Address,
          sourceSpec,
          targetCollection: collectionAddress,
          targetSpec,
          targetTokenId: targetSpec === BurnTokenSpec.ERC1155 ? BigInt(targetTokenId || '1') : 0n,
          burnRatio: BigInt(burnRatio || '1'),
          mintRatio: BigInt(mintRatio || '1'),
          totalRedemptionCap: BigInt(totalCap || '0'),
          perWalletCap: BigInt(perWalletCap || '0'),
          startTime: start,
          endTime: end,
          targetBaseURI,
        }),
      });
      setDone(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Config failed');
    } finally {
      setBusy(false);
    }
  }, [
    validationErrors,
    extensionAddress,
    isPreview,
    sendTransactionAsync,
    startTime,
    endTime,
    sourceContract,
    sourceSpec,
    collectionAddress,
    targetSpec,
    targetTokenId,
    burnRatio,
    mintRatio,
    totalCap,
    perWalletCap,
    targetBaseURI,
  ]);

  if (phase === 'wallet_missing') {
    return (
      <FlowShell
        title="Burn to mint"
        subtitle="Deploy your extension, register it on the collection, then set the burn window."
        breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Burn to mint' }}
        steps={STEPS}
        currentStep={step}
      >
        <WalletGate />
      </FlowShell>
    );
  }

  return (
    <FlowShell
      title="Burn to mint"
      subtitle="Each artist deploys their own BurnToMintExtension, registers it, then configures source → target."
      breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Burn to mint' }}
      steps={STEPS}
      currentStep={step}
      aside={
        <ArtPreview
          src={previewImage}
          caption={collectionName}
          subtitle={done ? 'Config live' : extensionAddress ? 'Extension ready' : 'Not deployed'}
          aspectRatio="4 / 5"
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
          {step === 1 && (
            <button type="button" className="studio-btn" disabled={busy} onClick={() => void handleDeploy()}>
              {busy ? 'Deploying…' : bytecodeAvailable ? 'Deploy extension' : 'Show deploy stub'}
            </button>
          )}
          {step === 2 && (
            <button type="button" className="studio-btn" disabled={busy} onClick={() => void handleRegister()}>
              {busy ? 'Registering…' : 'Register on collection'}
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || done || validationErrors.length > 0}
              onClick={() => void handleConfigure()}
            >
              {done ? 'Configured' : busy ? 'Saving…' : 'Create burn config'}
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
              ? 'No burn-to-mint extension configured yet.'
              : undefined
        }
        className="mb-6"
      />
      {stubReason && (
        <div className="mb-6 rounded-md border border-border bg-background-sunken px-4 py-3 text-sm text-muted">
          <p className="font-medium text-foreground">Stub</p>
          <p className="mt-1">{stubReason}</p>
        </div>
      )}
      <ValidationList errors={validationErrors} className="mb-6" />

      {step === 1 && (
        <div className="space-y-6">
          <p className="text-muted">
            Deploy <span className="font-medium text-foreground">BurnToMintExtension</span> with your wallet as owner.
            The extension owner must also own the target collection.
          </p>
          <ReviewRow label="Owner" value={address ?? '—'} />
          <ReviewRow label="Bytecode" value={bytecodeAvailable ? 'Available' : 'Pending PR 200'} />
          {extensionAddress && <ReviewRow label="Extension" value={extensionAddress} />}
          <FlowField label="Extension address" hint="Paste if you already deployed, or after the deploy confirms.">
            <input
              className="studio-input font-mono text-sm"
              value={extensionAddress}
              onChange={(e) => setExtensionAddress(e.target.value)}
              placeholder="0x…"
            />
          </FlowField>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <p className="text-muted">
            Register the extension on the target collection so it can call{' '}
            <code className="rounded bg-background-sunken px-1.5 py-0.5 text-sm">mintExtension</code>.
          </p>
          <ReviewRow label="Collection" value={collectionAddress} />
          <ReviewRow label="Extension" value={extensionAddress || '—'} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <FlowField label="Source contract">
            <input
              className="studio-input font-mono text-sm"
              value={sourceContract}
              onChange={(e) => setSourceContract(e.target.value)}
              placeholder="0x…"
            />
          </FlowField>
          <FlowField label="Source standard">
            <div className="flex gap-3">
              {(
                [
                  { id: BurnTokenSpec.ERC721, label: 'ERC-721' },
                  { id: BurnTokenSpec.ERC1155, label: 'ERC-1155' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSourceSpec(opt.id)}
                  className={`rounded-md border px-4 py-2 text-sm ${
                    sourceSpec === opt.id ? 'border-foreground' : 'border-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FlowField>
          <div className="grid grid-cols-2 gap-4">
            <FlowField label="Burn ratio">
              <input className="studio-input" value={burnRatio} onChange={(e) => setBurnRatio(e.target.value)} />
            </FlowField>
            <FlowField label="Mint ratio">
              <input className="studio-input" value={mintRatio} onChange={(e) => setMintRatio(e.target.value)} />
            </FlowField>
            <FlowField label="Total cap (0 = none)">
              <input className="studio-input" value={totalCap} onChange={(e) => setTotalCap(e.target.value)} />
            </FlowField>
            <FlowField label="Per-wallet cap (0 = none)">
              <input className="studio-input" value={perWalletCap} onChange={(e) => setPerWalletCap(e.target.value)} />
            </FlowField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FlowField label="Window start">
              <input type="datetime-local" className="studio-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </FlowField>
            <FlowField label="Window end">
              <input type="datetime-local" className="studio-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </FlowField>
          </div>
          {targetSpec === BurnTokenSpec.ERC721 ? (
            <FlowField label="Target base URI" hint="Must end with /. Tokens resolve as base + index.">
              <input
                className="studio-input font-mono text-sm"
                value={targetBaseURI}
                onChange={(e) => setTargetBaseURI(e.target.value)}
                placeholder="ar://burn-redeem/"
              />
            </FlowField>
          ) : (
            <FlowField label="Target token ID">
              <input className="studio-input" value={targetTokenId} onChange={(e) => setTargetTokenId(e.target.value)} />
            </FlowField>
          )}
        </div>
      )}
    </FlowShell>
  );
}
