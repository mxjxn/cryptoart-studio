export function Footer() {
  return (
    <footer className="w-full py-4 px-4 border-t border-[#333333]">
      <div className="max-w-7xl mx-auto">
        <div className="text-[10px] text-[#666666] flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://warpcast.com/~/channel/cryptoart"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#999999] transition-colors"
          >
            Channel
          </a>
          <span className="text-[#444444]">•</span>
          <a
            href="https://farcaster.xyz/mxjxn"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#999999] transition-colors"
          >
            Developer
          </a>
          <span className="text-[#444444]">•</span>
          <a
            href="https://mxjxn.github.io/cryptoart-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#999999] transition-colors"
          >
            Docs
          </a>
        </div>
      </div>
    </footer>
  );
}







