import { createConfig, createStorage, http } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors/coinbaseWallet';
import { injected } from 'wagmi/connectors/injected';
import { base, mainnet } from 'wagmi/chains';

export const wagmiConfig = createConfig({
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Cryptoart Social' }),
  ],
  storage: createStorage({ storage: window.sessionStorage }),
});
