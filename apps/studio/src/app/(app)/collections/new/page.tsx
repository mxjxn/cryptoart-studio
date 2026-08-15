'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { useCreateDraft, useUpdateDraft, type DraftPayload } from '~/hooks/useDrafts';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { Stepper } from '~/components/ui/Stepper';

const STEPS = ['Chain', 'Edition', 'Name', 'Royalties', 'Branding', 'Metadata', 'Deploy'];

export default function DeployWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');
  const { address, isConnected, chainId } = useActiveWallet();

  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  const [currentStep, setCurrentStep] = useState(1);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftId);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  const [formData, setFormData] = useState<DraftPayload>({
    step: 1,
    chainId: chainId ?? 8453,
    editionType: 'one',
    name: '',
    symbol: '',
    royaltiesOptOut: false,
    branding: {},
  });

  useEffect(() => {
    if (!draftId) return;
    fetch(`/api/drafts/${draftId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.payload) {
          setFormData(data.payload as DraftPayload);
          setCurrentStep(data.payload.step ?? 1);
        }
      })
      .catch(() => {});
  }, [draftId]);

  const saveDraft = useCallback(
    async (payload: DraftPayload) => {
      setSaving(true);
      try {
        if (activeDraftId) {
          await updateDraft.mutateAsync({ id: activeDraftId, payload });
        } else {
          const result = await createDraft.mutateAsync(payload);
          setActiveDraftId(result.id);
        }
      } finally {
        setSaving(false);
      }
    },
    [activeDraftId, createDraft, updateDraft],
  );

  const goNext = useCallback(async () => {
    const next = currentStep + 1;
    const payload = { ...formData, step: next };
    setFormData(payload);
    setCurrentStep(next);
    await saveDraft(payload);
  }, [currentStep, formData, saveDraft]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!address) return;
    setDeploying(true);
    try {
      const res = await fetch('/api/collections/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          symbol: formData.symbol,
          chainId: formData.chainId,
          ownerAddress: address,
          royaltyReceiver: address,
          royaltyBPS: formData.royaltiesOptOut ? 0 : 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDeploymentId(data.deploymentId);

      const hash = await sendTransactionAsync({
        to: data.txRequest.to as `0x${string}`,
        data: data.txRequest.data as `0x${string}`,
      });

      await fetch(`/api/collections/deploy/${data.deploymentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash, ownerAddress: address }),
      });
    } catch (err) {
      console.error('Deploy error:', err);
      setDeploying(false);
    }
  }, [address, formData, sendTransactionAsync]);

  useEffect(() => {
    if (receipt && deploymentId) {
      const poll = setInterval(async () => {
        const res = await fetch(`/api/collections/deploy/${deploymentId}/status`);
        const data = await res.json();
        if (data.status === 'confirmed' && data.collectionId) {
          clearInterval(poll);
          if (activeDraftId) {
            fetch(`/api/drafts/${activeDraftId}`, { method: 'DELETE' }).catch(() => {});
          }
          router.push(`/collections/${data.collectionId}`);
        }
      }, 3000);
      return () => clearInterval(poll);
    }
  }, [receipt, deploymentId, activeDraftId, router]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-2xl font-bold">Connect your wallet</h2>
        <p className="mt-2 text-muted">You need a connected wallet to deploy a collection.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-122px)] flex-col">
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-20 py-4">
          <Stepper steps={STEPS} currentStep={currentStep} />
          <div className="flex items-center gap-2 text-sm text-muted">
            {saving && (
              <>
                <span className="size-1.5 rounded-full bg-muted" />
                <span>Saving…</span>
              </>
            )}
            {!saving && activeDraftId && (
              <>
                <span className="size-1.5 rounded-full bg-success" />
                <span>Draft saved</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center pt-20">
        <div className="w-full max-w-[560px]">
          {currentStep === 1 && (
            <StepContent
              title="Choose your chain"
              subtitle="Where will this collection live?"
            >
              <div className="flex flex-col gap-3">
                {[
                  { id: 8453, label: 'Base', desc: 'Low gas fees, fast transactions' },
                  { id: 1, label: 'Ethereum', desc: 'The original chain for NFTs' },
                ].map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => setFormData((d) => ({ ...d, chainId: chain.id }))}
                    className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                      formData.chainId === chain.id
                        ? 'border-foreground bg-neutral-50'
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    <div>
                      <p className="font-medium">{chain.label}</p>
                      <p className="text-sm text-muted">{chain.desc}</p>
                    </div>
                    {formData.chainId === chain.id && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </StepContent>
          )}

          {currentStep === 2 && (
            <StepContent
              title="Edition type"
              subtitle="How many unique pieces will this collection hold?"
            >
              <div className="flex flex-col gap-3">
                {[
                  { id: 'one' as const, label: 'One-of-one', desc: 'A single unique piece' },
                  { id: 'multiple' as const, label: 'Multiple', desc: 'A series of related works' },
                ].map((edition) => (
                  <button
                    key={edition.id}
                    type="button"
                    onClick={() => setFormData((d) => ({ ...d, editionType: edition.id }))}
                    className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                      formData.editionType === edition.id
                        ? 'border-foreground bg-neutral-50'
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    <div>
                      <p className="font-medium">{edition.label}</p>
                      <p className="text-sm text-muted">{edition.desc}</p>
                    </div>
                    {formData.editionType === edition.id && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </StepContent>
          )}

          {currentStep === 3 && (
            <StepContent
              title="Name your collection"
              subtitle="This is the public-facing name and ticker symbol for your collection."
            >
              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-sm font-medium">Collection Name</label>
                  <input
                    type="text"
                    value={formData.name ?? ''}
                    onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Chromatic Frequencies"
                    className="studio-input mt-2"
                  />
                </div>
                <div className="max-w-[240px]">
                  <label className="text-sm font-medium">Symbol</label>
                  <input
                    type="text"
                    value={formData.symbol ?? ''}
                    onChange={(e) => setFormData((d) => ({ ...d, symbol: e.target.value.toUpperCase() }))}
                    placeholder="e.g. CHROMA"
                    className="studio-input mt-2"
                  />
                </div>
                <p className="text-sm text-muted">These cannot be changed after deployment.</p>
              </div>
            </StepContent>
          )}

          {currentStep === 4 && (
            <StepContent
              title="Royalties"
              subtitle="Set a secondary sale royalty percentage. Default is 10%."
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">10% royalty</p>
                    <p className="text-sm text-muted">Standard for most collections</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((d) => ({ ...d, royaltiesOptOut: !d.royaltiesOptOut }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      !formData.royaltiesOptOut ? 'bg-foreground' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                        !formData.royaltiesOptOut ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                {formData.royaltiesOptOut && (
                  <p className="text-sm text-warning">
                    Opting out means no secondary sale royalties will be enforced.
                  </p>
                )}
              </div>
            </StepContent>
          )}

          {currentStep === 5 && (
            <StepContent
              title="Collection branding"
              subtitle="Optional — add a description and images. You can edit these later."
            >
              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={formData.branding?.description ?? ''}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        branding: { ...d.branding, description: e.target.value },
                      }))
                    }
                    placeholder="Tell collectors about this collection…"
                    rows={4}
                    className="studio-textarea mt-2"
                  />
                </div>
                <p className="text-sm text-muted">
                  Image and banner uploads will be available after deployment.
                </p>
              </div>
            </StepContent>
          )}

          {currentStep === 6 && (
            <StepContent
              title="Metadata best practices"
              subtitle="Before minting, review the OpenSea metadata standard."
            >
              <div className="flex flex-col gap-4 text-sm text-muted">
                <p>
                  Each token needs a metadata JSON file following the{' '}
                  <a
                    href="https://docs.opensea.io/docs/metadata-standards"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline"
                  >
                    OpenSea metadata standard
                  </a>
                  . Fields include name, description, image, animation_url, and attributes.
                </p>
                <ul className="list-inside list-disc space-y-2">
                  <li>Thumbnail images should be under 5MB</li>
                  <li>Use GIF or still image for animated works</li>
                  <li>Pin metadata to Arweave before minting</li>
                </ul>
              </div>
            </StepContent>
          )}

          {currentStep === 7 && (
            <StepContent
              title="Review & deploy"
              subtitle="Confirm your collection settings before deploying."
            >
              <div className="flex flex-col gap-4">
                <ReviewRow label="Name" value={formData.name ?? ''} />
                <ReviewRow label="Symbol" value={formData.symbol ?? ''} />
                <ReviewRow label="Chain" value={formData.chainId === 1 ? 'Ethereum' : 'Base'} />
                <ReviewRow label="Edition" value={formData.editionType === 'one' ? 'One-of-one' : 'Multiple'} />
                <ReviewRow label="Royalties" value={formData.royaltiesOptOut ? 'None (opted out)' : '10%'} />
                {formData.branding?.description && (
                  <ReviewRow label="Description" value={formData.branding.description} />
                )}
              </div>
              {deploying && (
                <div className="mt-6 rounded-lg border border-border bg-neutral-50 px-4 py-3 text-sm text-muted">
                  {receipt ? 'Waiting for confirmation…' : 'Confirm the transaction in your wallet…'}
                </div>
              )}
            </StepContent>
          )}

          <div className="mt-10 flex items-center justify-between pb-16">
            <button
              type="button"
              onClick={goBack}
              className={currentStep === 1 ? 'invisible' : 'text-[15px] text-muted hover:text-foreground'}
            >
              ← Back
            </button>
            {currentStep < 7 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={currentStep === 3 && (!formData.name || !formData.symbol)}
                className="studio-btn disabled:opacity-40"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDeploy}
                disabled={deploying || !formData.name || !formData.symbol}
                className="studio-btn disabled:opacity-40"
              >
                {deploying ? 'Deploying…' : 'Deploy Collection'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepContent({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-3 text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
