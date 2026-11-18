export function DeskPlainLink({ href, label }: { href: string; label?: string }) {
  let host = href;
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* keep */ }
  return <a href={href} className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#141414] px-2.5 py-2 text-[12px] text-[#cfcfcf] hover:border-[#444]" rel="noreferrer" target="_blank">
    <span className="cryptoart-mono truncate text-[#dcf54c]">{label ?? host}</span>
    <span className="text-[#666]">↗</span>
  </a>;
}