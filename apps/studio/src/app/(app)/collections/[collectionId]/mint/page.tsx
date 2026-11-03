'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { Stepper } from '~/components/ui/Stepper';
import { DropZone } from '~/components/ui/DropZone';
import { useCollection } from '~/hooks/useCollections';
import { cn } from '~/lib/utils';

const STEPS = ['Upload', 'Metadata', 'Review', 'Mint'];

interface Attribute {
  trait_type: string;
  value: string;
}

interface TokenMetadata {
  name: string;
  description: string;
  animationUrl: string;
  attributes: Attribute[];
}

export default function MintWizardPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const { data: collection } = useCollection(collectionId);

  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata>({
    name: '',
    description: '',
    animationUrl: '',
    attributes: [],
  });

  const handleFiles = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const addAttribute = useCallback(() => {
    setMetadata((m) => ({
      ...m,
      attributes: [...m.attributes, { trait_type: '', value: '' }],
    }));
  }, []);

  const removeAttribute = useCallback((index: number) => {
    setMetadata((m) => ({
      ...m,
      attributes: m.attributes.filter((_, i) => i !== index),
    }));
  }, []);

  const updateAttribute = useCallback(
    (index: number, field: 'trait_type' | 'value', val: string) => {
      setMetadata((m) => ({
        ...m,
        attributes: m.attributes.map((a, i) =>
          i === index ? { ...a, [field]: val } : a,
        ),
      }));
    },
    [],
  );

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(STEPS.length, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const canContinue = (() => {
    if (currentStep === 1) return !!file;
    if (currentStep === 2) return !!metadata.name;
    return true;
  })();

  const collectionName = collection?.name ?? 'Collection';

  const reviewJson = {
    name: metadata.name,
    description: metadata.description,
    image: file?.name ?? '',
    ...(metadata.animationUrl ? { animation_url: metadata.animationUrl } : {}),
    ...(metadata.attributes.length > 0
      ? {
          attributes: metadata.attributes
            .filter((a) => a.trait_type && a.value)
            .map((a) => ({ trait_type: a.trait_type, value: a.value })),
        }
      : {}),
  };

  return (
    <div className="flex min-h-[calc(100vh-122px)] flex-col">
      {/* Stepper bar */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-20 py-4">
          <Stepper steps={STEPS} currentStep={currentStep} />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mx-auto w-full max-w-[1280px] px-20 pt-8">
        <nav className="flex items-center gap-1.5 text-sm text-muted">
          <Link
            href={`/collections/${collectionId}`}
            className="hover:text-foreground"
          >
            {collectionName}
          </Link>
          <span>›</span>
          <span className="text-foreground">Mint</span>
        </nav>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-[1280px] flex-1 px-20 py-10">
        {currentStep === 1 && <StepUpload file={file} preview={preview} onFiles={handleFiles} />}
        {currentStep === 2 && (
          <StepMetadata
            metadata={metadata}
            setMetadata={setMetadata}
            preview={preview}
            fileName={file?.name}
            onAddAttribute={addAttribute}
            onRemoveAttribute={removeAttribute}
            onUpdateAttribute={updateAttribute}
          />
        )}
        {currentStep === 3 && (
          <StepReview reviewJson={reviewJson} preview={preview} />
        )}
        {currentStep === 4 && (
          <StepMint reviewJson={reviewJson} preview={preview} />
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-20 py-4">
          <button
            type="button"
            onClick={goBack}
            className={cn(
              'text-[15px] text-muted hover:text-foreground',
              currentStep === 1 && 'invisible',
            )}
          >
            ← Back
          </button>
          {currentStep < 3 && (
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue}
              className="studio-btn disabled:opacity-40"
            >
              {currentStep === 2 ? 'Continue to Review' : 'Continue →'}
            </button>
          )}
          {currentStep === 3 && (
            <button
              type="button"
              onClick={goNext}
              className="studio-btn"
            >
              Continue to Mint
            </button>
          )}
          {currentStep === 4 && (
            <button
              type="button"
              disabled
              className="studio-btn disabled:opacity-40"
            >
              Mint — Arweave integration required
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Upload                                                   */
/* ------------------------------------------------------------------ */

function StepUpload({
  file,
  preview,
  onFiles,
}: {
  file: File | null;
  preview: string | null;
  onFiles: (files: File[]) => void;
}) {
  return (
    <div className="mx-auto max-w-[560px]">
      <h2 className="text-3xl font-bold">Upload media</h2>
      <p className="mt-3 text-muted">
        Choose the image or media file for your token.
      </p>

      <div className="mt-8">
        {!file ? (
          <DropZone
            accept="image/*,video/*,audio/*"
            onFiles={onFiles}
            hint="PNG, JPG, GIF, SVG, MP4, WEBM. Max 100MB."
          />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border p-6">
            {preview && (
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 rounded-md object-contain"
              />
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">{file.name}</span>
              <span className="text-muted">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
              <button
                type="button"
                onClick={() => onFiles([])}
                className="text-muted hover:text-foreground"
              >
                Change
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-neutral-50 px-4 py-3 text-sm text-muted">
        Arweave upload will be available soon.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Metadata                                                 */
/* ------------------------------------------------------------------ */

function StepMetadata({
  metadata,
  setMetadata,
  preview,
  fileName,
  onAddAttribute,
  onRemoveAttribute,
  onUpdateAttribute,
}: {
  metadata: TokenMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<TokenMetadata>>;
  preview: string | null;
  fileName?: string;
  onAddAttribute: () => void;
  onRemoveAttribute: (i: number) => void;
  onUpdateAttribute: (i: number, field: 'trait_type' | 'value', val: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
      {/* Form column */}
      <div>
        <h2 className="text-3xl font-bold">Token metadata</h2>
        <p className="mt-3 text-muted">
          Define the on-chain metadata for your token following the OpenSea
          standard.
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {/* Token Name */}
          <div>
            <label className="text-sm font-medium">Token Name</label>
            <input
              type="text"
              value={metadata.name}
              onChange={(e) =>
                setMetadata((m) => ({ ...m, name: e.target.value }))
              }
              placeholder="e.g. Chromatic Frequency #1"
              className="studio-input mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={metadata.description}
              onChange={(e) =>
                setMetadata((m) => ({ ...m, description: e.target.value }))
              }
              placeholder="Describe this piece…"
              rows={4}
              className="studio-textarea mt-2"
            />
          </div>

          {/* Image row */}
          <div>
            <label className="text-sm font-medium">Image</label>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              {preview ? (
                <>
                  <img
                    src={preview}
                    alt="Thumb"
                    className="size-10 rounded object-cover"
                  />
                  <span className="flex-1 truncate text-sm">{fileName}</span>
                  <span className="flex items-center gap-1.5 text-sm text-success">
                    <span className="size-1.5 rounded-full bg-success" />
                    Uploaded
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted">
                  No image — go back to Upload step
                </span>
              )}
            </div>
          </div>

          {/* Animation URL */}
          <div>
            <label className="text-sm font-medium">
              Animation URL{' '}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              type="url"
              value={metadata.animationUrl}
              onChange={(e) =>
                setMetadata((m) => ({ ...m, animationUrl: e.target.value }))
              }
              placeholder="https://..."
              className="studio-input mt-2"
            />
          </div>

          {/* Attributes */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Attributes</label>
              <button
                type="button"
                onClick={onAddAttribute}
                className="text-sm text-muted hover:text-foreground"
              >
                + Add attribute
              </button>
            </div>

            {metadata.attributes.length === 0 && (
              <p className="mt-2 text-sm text-muted">
                No attributes yet. Add key-value pairs to describe traits.
              </p>
            )}

            <div className="mt-3 flex flex-col gap-3">
              {metadata.attributes.map((attr, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={attr.trait_type}
                    onChange={(e) =>
                      onUpdateAttribute(i, 'trait_type', e.target.value)
                    }
                    placeholder="Trait name"
                    className="studio-input flex-1"
                  />
                  <input
                    type="text"
                    value={attr.value}
                    onChange={(e) =>
                      onUpdateAttribute(i, 'value', e.target.value)
                    }
                    placeholder="Value"
                    className="studio-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveAttribute(i)}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-foreground hover:text-foreground"
                    aria-label="Remove attribute"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview column */}
      <PreviewCard
        preview={preview}
        name={metadata.name}
        description={metadata.description}
        attributes={metadata.attributes}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Review                                                   */
/* ------------------------------------------------------------------ */

function StepReview({
  reviewJson,
  preview,
}: {
  reviewJson: Record<string, unknown>;
  preview: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
      <div>
        <h2 className="text-3xl font-bold">Review metadata</h2>
        <p className="mt-3 text-muted">
          Confirm the token metadata JSON that will be pinned to Arweave.
        </p>

        <pre className="mt-8 overflow-auto rounded-lg border border-border bg-neutral-50 p-6 text-sm leading-relaxed">
          {JSON.stringify(reviewJson, null, 2)}
        </pre>
      </div>

      <PreviewCard
        preview={preview}
        name={reviewJson.name as string}
        description={reviewJson.description as string}
        attributes={
          (reviewJson.attributes as Attribute[] | undefined) ?? []
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Mint                                                     */
/* ------------------------------------------------------------------ */

function StepMint({
  reviewJson,
  preview,
}: {
  reviewJson: Record<string, unknown>;
  preview: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
      <div>
        <h2 className="text-3xl font-bold">Mint token</h2>
        <p className="mt-3 text-muted">
          Submit an on-chain <code className="text-foreground">mint(to, uri)</code>{' '}
          transaction to create your token.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-sm text-muted">Token Name</span>
            <span className="text-sm font-medium">
              {(reviewJson.name as string) || '—'}
            </span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-sm text-muted">Image</span>
            <span className="text-sm font-medium">
              {(reviewJson.image as string) || '—'}
            </span>
          </div>
          {(reviewJson.animation_url as string) && (
            <div className="flex justify-between border-b border-border pb-3">
              <span className="text-sm text-muted">Animation URL</span>
              <span className="max-w-[260px] truncate text-sm font-medium">
                {reviewJson.animation_url as string}
              </span>
            </div>
          )}
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-sm text-muted">Attributes</span>
            <span className="text-sm font-medium">
              {(reviewJson.attributes as Attribute[] | undefined)?.length ?? 0}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-neutral-50 px-4 py-3 text-sm text-muted">
          Minting is disabled until the Arweave upload pipeline is integrated.
          The metadata JSON must be pinned before calling{' '}
          <code className="text-foreground">mint()</code>.
        </div>
      </div>

      <PreviewCard
        preview={preview}
        name={reviewJson.name as string}
        description={reviewJson.description as string}
        attributes={
          (reviewJson.attributes as Attribute[] | undefined) ?? []
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview Card (shared sidebar)                                     */
/* ------------------------------------------------------------------ */

function PreviewCard({
  preview,
  name,
  description,
  attributes,
}: {
  preview: string | null;
  name: string;
  description: string;
  attributes: Attribute[];
}) {
  return (
    <div className="sticky top-8 rounded-lg border border-border">
      {/* Image */}
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-lg bg-neutral-50">
        {preview ? (
          <img
            src={preview}
            alt={name || 'Token preview'}
            className="size-full object-cover"
          />
        ) : (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-border"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold">
          {name || <span className="text-muted">Untitled</span>}
        </h3>
        {description && (
          <p className="line-clamp-3 text-sm text-muted">{description}</p>
        )}

        {/* Attribute chips */}
        {attributes.filter((a) => a.trait_type && a.value).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attributes
              .filter((a) => a.trait_type && a.value)
              .map((a, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border px-2.5 py-1 text-xs"
                >
                  <span className="text-muted">{a.trait_type}:</span>{' '}
                  <span className="font-medium">{a.value}</span>
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
