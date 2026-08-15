'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { DropZone } from '~/components/ui/DropZone';
import { useCollection } from '~/hooks/useCollections';
import { cn } from '~/lib/utils';

type Page = 'instructions' | 'upload';

const PIPELINE_STEPS = [
  {
    label: 'Validate',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    label: 'Pin to Arweave',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    label: 'Mint Batch',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
] as const;

export default function SeriesMintPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const { data: collection } = useCollection(collectionId);
  const [page, setPage] = useState<Page>('instructions');
  const [zipFile, setZipFile] = useState<File | null>(null);

  const handleFiles = useCallback((files: File[]) => {
    const zip = files.find((f) => f.name.endsWith('.zip'));
    if (zip) setZipFile(zip);
  }, []);

  if (page === 'instructions') {
    return <InstructionsPage onContinue={() => setPage('upload')} />;
  }

  return (
    <div className="flex min-h-[calc(100vh-122px)] flex-col">
      <div className="flex flex-1 items-start justify-center pt-12">
        <div className="w-full max-w-[640px] pb-16">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-muted">
            <Link
              href={`/collections/${collectionId}`}
              className="hover:text-foreground"
            >
              {collection?.name ?? 'Collection'}
            </Link>
            <span className="mx-2">›</span>
            <span className="text-foreground">Series Mint</span>
          </nav>

          {/* Heading */}
          <h1 className="text-3xl font-bold">Upload your series</h1>
          <p className="mt-3 text-muted">
            Upload a ZIP file containing your artwork files and a{' '}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
              metadata.csv
            </code>{' '}
            mapping each file to its on-chain metadata.
          </p>

          {/* Drop zone */}
          <div className="mt-8">
            <DropZone
              accept=".zip"
              onFiles={handleFiles}
              label="Drag and drop your ZIP here"
              hint={
                zipFile
                  ? `Selected: ${zipFile.name} (${(zipFile.size / 1024 / 1024).toFixed(1)} MB)`
                  : 'Accepts .zip files up to 500 MB'
              }
              className={zipFile ? 'border-foreground bg-neutral-50' : undefined}
            />
          </div>

          {/* Pipeline visualization */}
          <div className="mt-10">
            <p className="mb-4 text-sm font-medium">Mint pipeline</p>
            <div className="flex items-center justify-between">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex size-12 items-center justify-center rounded-full border-2 border-border text-muted">
                      {step.icon}
                    </div>
                    <span className="text-xs text-muted">{step.label}</span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className="mx-4 h-0.5 w-16 bg-border" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Gas estimate card */}
          <div className="studio-card mt-8 flex items-start gap-3 p-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-muted">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <p className="text-sm font-medium">
                Estimated gas: ~0.008 ETH (48 tokens on Base)
              </p>
              <p className="mt-1 text-xs text-muted">(non-blocking estimate)</p>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="mt-10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage('instructions')}
              className="text-[15px] text-muted hover:text-foreground"
            >
              ← Back to Instructions
            </button>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled
                className="studio-btn disabled:opacity-40"
              >
                Upload &amp; Mint
              </button>
              <span className="text-xs text-muted">
                Series processing API coming soon
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstructionsPage({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex min-h-[calc(100vh-122px)] flex-col">
      <div className="flex flex-1 items-start justify-center pt-12">
        <div className="w-full max-w-[640px] pb-16">
          <h1 className="text-3xl font-bold">Batch Mint a Series</h1>
          <p className="mt-3 text-muted">
            Mint multiple tokens in a single transaction by uploading a prepared
            ZIP file. Follow the steps below to get set up.
          </p>

          {/* Step-by-step instructions */}
          <ol className="mt-8 flex flex-col gap-6">
            <InstructionStep number={1} title="Prepare your artwork files">
              <p>
                Collect all artwork files (PNG, JPEG, GIF, MP4, or HTML) in a
                single folder. Name each file sequentially — e.g.{' '}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
                  001.png
                </code>
                ,{' '}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
                  002.png
                </code>
                , etc.
              </p>
            </InstructionStep>

            <InstructionStep number={2} title="Create a metadata.csv">
              <p>
                Add a{' '}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
                  metadata.csv
                </code>{' '}
                at the root of the folder with columns:{' '}
                <strong>file</strong>, <strong>name</strong>,{' '}
                <strong>description</strong>, and any{' '}
                <strong>attributes</strong> you want on-chain.
              </p>
            </InstructionStep>

            <InstructionStep number={3} title="Zip everything together">
              <p>
                Compress the folder into a single{' '}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
                  .zip
                </code>{' '}
                file. The ZIP should contain your artwork files and the
                metadata.csv at the top level — no nested folders.
              </p>
            </InstructionStep>

            <InstructionStep number={4} title="Review batch sizes">
              <p>
                Each transaction can mint up to <strong>50 tokens</strong>.
                Larger series will be automatically split into multiple
                batches. On Base, expect roughly{' '}
                <strong>~0.008 ETH</strong> in gas per 48-token batch.
              </p>
            </InstructionStep>
          </ol>

          {/* Download example */}
          <div className="mt-8 rounded-lg border border-border bg-neutral-50 px-5 py-4">
            <p className="text-sm">
              Not sure how to structure your files?{' '}
              <a
                href="/downloads/series-example.zip"
                className="font-medium text-foreground underline"
              >
                Download an example ZIP
              </a>{' '}
              to see the expected format.
            </p>
          </div>

          {/* Continue button */}
          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={onContinue}
              className="studio-btn"
            >
              Continue to Upload →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstructionStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium">
        {number}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <div className="mt-1 text-sm text-muted">{children}</div>
      </div>
    </li>
  );
}
