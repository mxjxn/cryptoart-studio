import { robinhood } from 'farcaster-client-data';
import { bsc, degen, monadTestnet, unichain } from 'viem/chains';
import { Config, createConfig, createStorage, http, Transport } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors/coinbaseWallet';
import { injected } from 'wagmi/connectors/injected';
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  celo,
  gnosis,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  sepolia,
  zora,
} from 'wagmi/chains';

const chains = [
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  degen,
  gnosis,
  optimism,
  optimismSepolia,
  polygon,
  zora,
  unichain,
  monadTestnet,
  celo,
  sepolia,
  mainnet,
  bsc,
  robinhood,
] as const;

const transports = chains.reduce(
  (acc, chain) => {
    acc[chain.id] = http();
    return acc;
  },
  {} as Record<number, Transport>,
);

const wagmiConfig: Config = createConfig({
  chains,
  transports,
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Cryptoart Social' }),
  ],
  storage: createStorage({ storage: window.sessionStorage }),
});

export { wagmiConfig };
