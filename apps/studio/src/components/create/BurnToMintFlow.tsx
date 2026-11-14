'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { ArtPreview } from '~/components/flows/ArtPreview';
import { FlowDetails, FlowField, FlowShell, ReviewRow } from '~/components/flows/FlowShell';
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
import { encodeRegisterExtension, ensureTrailingSlash } from '~/lib/adapters/such-collection';

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
  previewAspectRatio?: string;
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
  previewAspectRatio = '7 / 4',
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
  const [targetBaseURI, setTargetBaseURI] = useState(isPreview ? 'ar://burn-redeem' : '');
  const [targetTokenId, setTargetTokenId] = useState('1');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [stubReason, setStubReason] = useState<string | null>(
    !bytecodeAvailable && !isPreview
      ? 'The burn-to-mint contract isn’t available in this environment yet. You can still walk through the screens.'
      : null,
  );
  const [done, setDone] = useState(previewScenario === 'confirmed');

  const targetSpec =
    tokenStandard === 'erc1155' ? BurnTokenSpec.ERC1155 : BurnTokenSpec.ERC721;

  const validationErrors = useMemo(() => {
    if (previewScenario === 'validation_error') {
      return ['Enter a valid source collection address.', 'Add a link for the new artwork folder.'];
    }
    if (step !== 3) return [];
    // Artist-facing messages — trailing slash is enforced silently at encode time.
    const raw = validateBurnConfigForm({
      sourceContract,
      targetBaseURI: targetBaseURI.trim() ? ensureTrailingSlash(targetBaseURI.trim()) : '',
      burnRatio: Number(burnRatio),
      mintRatio: Number(mintRatio),
      targetSpec,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    });
    return raw.map((msg) => {
      if (msg.includes('trailing slash')) return 'Add a link for the new artwork folder.';
      if (msg.includes('valid address')) return 'Enter a valid source collection address.';
      if (msg.includes('Burn ratio')) return 'Burn amount must be at least 1.';
      if (msg.includes('Mint ratio')) return 'Mint amount must be at least 1.';
      if (msg.includes('End time')) return 'The end must be after the start.';
      if (msg.includes('Target base URI is required')) return 'Add a link for the new artwork folder.';
      return msg;
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
      setLocalError('Paste the extension address from the deploy step first.');
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
        data: encodeRegisterExtension(
          extensionAddress as Address,
          ensureTrailingSlash(targetBaseURI.trim() || 'ar://'),
        ),
      });
      setStep(3);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Couldn’t connect the extension.');
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
          targetBaseURI: ensureTrailingSlash(targetBaseURI.trim()),
        }),
      });
      setDone(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Couldn’t save the burn setup.');
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
        subtitle="Deploy one extension for this collection, connect it, then set what collectors burn and receive."
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
      subtitle="Each collection gets its own extension in Studio. Collectors burn from a source and receive new work from this collection."
      breadcrumb={{ href: `/collections/${collectionId}`, label: collectionName, current: 'Burn to mint' }}
      steps={STEPS}
      currentStep={step}
      aside={
        <ArtPreview
          src={previewScenario === 'empty' ? null : previewImage}
          aspectRatio={previewAspectRatio}
          caption={previewScenario === 'empty' ? undefined : collectionName}
          subtitle={
            previewScenario === 'empty'
              ? undefined
              : done
                ? 'Burn setup live'
                : extensionAddress
                  ? 'Extension ready'
                  : 'Not deployed'
          }
          emptyTitle="No artwork yet"
          emptyHint="Your target collection’s look will show here."
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
              {busy ? 'Deploying…' : bytecodeAvailable ? 'Deploy extension' : 'Continue with stub'}
            </button>
          )}
          {step === 2 && (
            <button type="button" className="studio-btn" disabled={busy} onClick={() => void handleRegister()}>
              {busy ? 'Connecting…' : 'Connect to collection'}
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || done || validationErrors.length > 0}
              onClick={() => void handleConfigure()}
            >
              {done ? 'Configured' : busy ? 'Saving…' : 'Save burn setup'}
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
              ? 'No burn-to-mint extension for this collection yet.'
              : undefined
        }
        className="mb-6"
      />
      {stubReason && (
        <div className="mb-6 rounded-md border border-border bg-background-sunken px-4 py-3 text-sm text-muted">
          <p className="font-medium text-foreground">Not deployable here yet</p>
          <p className="mt-1">{stubReason}</p>
        </div>
      )}
      <ValidationList errors={validationErrors} className="mb-6" />

      {step === 1 && (
        <div className="space-y-6">
          <p className="text-muted">
            Deploy one burn-to-mint extension owned by your wallet for this collection. Burn setup lives in Studio —
            such.market only shows collectors how to redeem later.
          </p>
          <ReviewRow label="Owner" value={address ?? '—'} />
          <ReviewRow label="Ready to deploy" value={bytecodeAvailable ? 'Yes' : 'Pending contract release'} />
          {extensionAddress && <ReviewRow label="Extension" value={extensionAddress} />}
          <FlowField label="Extension address" hint="Paste after deploy confirms, or if you already deployed.">
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
            Connect the extension to this collection so it can mint the new pieces when someone burns.
          </p>
          <ReviewRow label="Collection" value={collectionAddress} />
          <ReviewRow label="Extension" value={extensionAddress || '—'} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <FlowField label="Source collection" hint="What collectors burn from.">
            <input
              className="studio-input font-mono text-sm"
              value={sourceContract}
              onChange={(e) => setSourceContract(e.target.value)}
              placeholder="0x…"
            />
          </FlowField>
          <FlowField label="Source type">
            <div className="flex gap-3">
              {(
                [
                  { id: BurnTokenSpec.ERC721, label: 'Unique pieces' },
                  { id: BurnTokenSpec.ERC1155, label: 'Editions' },
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
            <FlowField label="Burn this many">
              <input className="studio-input" value={burnRatio} onChange={(e) => setBurnRatio(e.target.value)} />
            </FlowField>
            <FlowField label="Receive this many">
              <input className="studio-input" value={mintRatio} onChange={(e) => setMintRatio(e.target.value)} />
            </FlowField>
            <FlowField label="Total cap (0 = none)">
              <input className="studio-input" value={totalCap} onChange={(e) => setTotalCap(e.target.value)} />
            </FlowField>
            <FlowField label="Per wallet (0 = none)">
              <input className="studio-input" value={perWalletCap} onChange={(e) => setPerWalletCap(e.target.value)} />
            </FlowField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FlowField label="Opens">
              <input type="datetime-local" className="studio-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </FlowField>
            <FlowField label="Closes">
              <input type="datetime-local" className="studio-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </FlowField>
          </div>
          {targetSpec === BurnTokenSpec.ERC721 ? (
            <FlowField label="New artwork folder" hint="Where the minted pieces’ metadata lives.">
              <input
                className="studio-input font-mono text-sm"
                value={targetBaseURI}
                onChange={(e) => setTargetBaseURI(e.target.value)}
                placeholder="ar://burn-redeem"
              />
            </FlowField>
          ) : (
            <FlowField label="Edition token number">
              <input className="studio-input" value={targetTokenId} onChange={(e) => setTargetTokenId(e.target.value)} />
            </FlowField>
          )}
          <FlowDetails>
            <p>Each collection gets one burn-to-mint setup. Redeem later still happens through Studio’s extension — such.market only shows collectors how.</p>
          </FlowDetails>
        </div>
      )}
    </FlowShell>
  );
}
