import Link from 'next/link';

export function GenerativeHowTo() {
  return (
    <article className="prose prose-neutral max-w-none text-sm text-foreground prose-headings:text-foreground prose-p:text-muted">
      <h2 className="text-xl font-bold text-foreground">How to ship generative HTML</h2>
      <ol className="list-decimal pl-5 text-muted">
        <li>Pick a template, edit the sketch, and preview with a stable seed.</li>
        <li>Pin a self-contained HTML file (bundle `cryptoart-runtime.js` for production).</li>
        <li>Set metadata `animation_mime_type` to <code className="text-foreground">html/generative</code>.</li>
        <li>Register and mint through <code className="text-foreground">GenerativeParametersExtension</code> for on-chain params and seed.</li>
        <li>Call <code className="text-foreground">$cryptoart.notifyReady()</code> when the canvas is done (preview capture).</li>
      </ol>
      <p className="text-muted">
        Full design notes (URL vs RPC trade-offs, derived keys, tests) are in{' '}
        <Link href="https://github.com/mxjxn/cryptoart-studio/blob/main/docs/generative-html-nfts.md" className="underline">
          docs/generative-html-nfts.md
        </Link>
        .
      </p>
    </article>
  );
}