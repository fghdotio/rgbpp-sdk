import { ccc } from '@ckb-ccc/core';

export interface IRpcClient {
  waitTransaction(
    txHash: string,
    confirmations?: number,
    timeout?: number,
    interval?: number,
  ): Promise<ccc.ClientTransactionResponse | undefined>;
}

export interface ISigner {
  sendTransaction(tx: ccc.TransactionLike): Promise<string>;
}

export interface IXudtPartialTxBuilder {
  issuanceTx(): Promise<void>;
  transferTx(): Promise<void>;
  batchTransferTx(): Promise<void>;
  leapFromBtcToCkbTx(): Promise<void>;
  leapFromCkbToBtcTx(): Promise<void>;
  btcTimeCellsSpentTx(): Promise<void>;
}

export interface ISporePartialTxBuilder {
  createClusterTx(): Promise<void>;
  creationTx(): Promise<void>;
  transferTx(): Promise<void>;
  leapFromBtcToCkbTx(): Promise<void>;
  leapFromCkbToBtcTx(): Promise<void>;
  btcTimeCellsSpentTx(): Promise<void>;
}
