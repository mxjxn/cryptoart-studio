export type TxPhase =
  | 'idle'
  | 'wallet_missing'
  | 'wrong_chain'
  | 'validating'
  | 'awaiting_signature'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'insufficient_funds'
  | 'empty';

export type FlowMode = 'live' | 'preview';

export type PreviewScenario =
  | 'default'
  | 'wallet_missing'
  | 'wrong_chain'
  | 'validation_error'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'insufficient_funds'
  | 'empty'
  | 'locked'
  | 'revealed';

export type FlowShellProps = {
  mode?: FlowMode;
  previewScenario?: PreviewScenario;
  collectionName?: string;
  collectionId?: string;
  chainId?: number;
  expectedChainId?: number;
};
