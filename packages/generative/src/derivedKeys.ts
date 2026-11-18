/** Logical names for values returned by `GenerativeParametersExtension.getDerivedValue`. */
export const BUILTIN_DERIVED_LABELS = [
  'cryptoart.derived.tokenId',
  'cryptoart.derived.seed',
  'cryptoart.derived.mintBlock',
  'cryptoart.derived.mintTimestamp',
  'cryptoart.derived.mintBlockHash',
  'cryptoart.derived.mintIndex',
  'cryptoart.derived.extensionMintCount',
  'cryptoart.derived.currentBlock',
  'cryptoart.derived.currentTimestamp',
] as const;

export type BuiltinDerivedLabel = (typeof BUILTIN_DERIVED_LABELS)[number];

export const GENERATIVE_ANIMATION_MIME = 'html/generative' as const;