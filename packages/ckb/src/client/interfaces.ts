import { ccc } from '@ckb-ccc/core';

import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

import { CkbWaitTransactionConfig, CkbTxHash } from './types';
import {
  RgbppTokenInfo,
  BTCTestnetType,
  RgbppLaunchVirtualTxResult,
  RgbppBtcAddressReceiver,
  BtcBatchTransferVirtualTxResult,
  BtcTransferVirtualTxResult,
} from '../types';
import { Collector } from '../collector';
import { RgbppXudtIssuanceResult } from './types';

export interface ICkbClient {
  getCollector(): Collector;

  generateRgbppLockScript(outIndex: number, btcTxId?: string, btcTestnetType?: BTCTestnetType): ccc.Script;

  isOnMainnet(): boolean;

  newCkbTxHash(txHash: string): CkbTxHash;

  sendTransaction(tx: CKBComponents.RawTransaction): Promise<CkbTxHash>;
  signAndSendTransaction(
    tx: ccc.TransactionLike,
    config?: CkbWaitTransactionConfig,
  ): Promise<{
    txHash: CkbTxHash | string;
    res: ccc.ClientTransactionResponse | undefined;
  }>;

  assembleXudtIssuanceTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction>;

  assembleXudtBatchTransferTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction>;

  assembleLeapFromCkbToBtcTx(ckbRawTx: CKBComponents.RawTransaction): Promise<CKBComponents.RawTransaction>;

  xudtIssuancePreparationTx(
    tokenInfo: RgbppTokenInfo,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
  ): Promise<ccc.Transaction>;

  xudtIssuanceTx(
    tokenInfo: RgbppTokenInfo,
    amount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType: BTCTestnetType | undefined,
    feeRate?: bigint,
  ): Promise<RgbppXudtIssuanceResult>;

  xudtBatchTransferTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    rgbppReceivers: RgbppBtcAddressReceiver[],
    btcTestnetType: BTCTestnetType | undefined,
  ): Promise<BtcBatchTransferVirtualTxResult>;

  xudtLeapFromCkbToBtcTx(
    xudtTypeArgs: string,
    leapAmount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<CKBComponents.RawTransaction>;

  xudtTransferTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    transferAmount: bigint,
    btcTestnetType: BTCTestnetType | undefined,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcTransferVirtualTxResult>;
}

export interface IRpcClient {
  waitTransaction(
    txHash: string,
    confirmations?: number,
    timeout?: number,
    interval?: number,
  ): Promise<ccc.ClientTransactionResponse | undefined>;
}

export interface ISigner {
  getSigner(): ccc.SignerCkbPrivateKey;
  signAndSendTransaction(
    tx: ccc.TransactionLike,
    config?: CkbWaitTransactionConfig,
  ): Promise<{
    txHash: CkbTxHash | string;
    res: ccc.ClientTransactionResponse | undefined;
  }>;
}

export interface IXudtTxBuilder {
  issuanceCellCapacity(tokenInfo: RgbppTokenInfo): bigint;
  generateRgbppLockScript(btcOutIndex: number, btcTxId?: string, btcTestnetType?: BTCTestnetType): ccc.Script;
  issuancePreparationTx(
    tokenInfo: RgbppTokenInfo,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
  ): ccc.Transaction;

  assembleIssuanceTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction>;

  assembleBatchTransferTx(
    ckbRawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    ckbPrivateKey: string,
    issuerCkbAddress: string,
    collector: Collector,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction>;

  assembleLeapFromCkbToBtcTx(
    ckbRawTx: CKBComponents.RawTransaction,
    collector: Collector,
    ckbPrivateKey: string,
  ): Promise<CKBComponents.RawTransaction>;

  // partial tx
  issuanceTx(
    collector: Collector,
    tokenInfo: RgbppTokenInfo,
    amount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType: BTCTestnetType,
    feeRate?: bigint,
  ): Promise<RgbppLaunchVirtualTxResult>;

  batchTransferTx(
    collector: Collector,
    xudtTypeArgs: string,
    btcOutpoints: {
      btcTxId: string;
      btcOutIdx: number;
    }[],
    rgbppReceivers: RgbppBtcAddressReceiver[],
    btcTestnetType: BTCTestnetType | undefined,
  ): Promise<BtcBatchTransferVirtualTxResult>;

  transferTx(
    collector: Collector,
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    transferAmount: bigint,
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcTransferVirtualTxResult>;

  leapFromBtcToCkbTx(): Promise<void>;
  btcTimeCellsSpentTx(): Promise<void>;

  leapFromCkbToBtcTx(
    collector: Collector,
    xudtTypeArgs: string,
    fromCkbAddress: string,
    btcTxId: string,
    btcOutIdx: number,
    leapAmount: bigint,
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<CKBComponents.RawTransaction>;
}

export interface ISporePartialTxBuilder {
  createClusterTx(): Promise<void>;
  creationTx(): Promise<void>;
  transferTx(): Promise<void>;
  leapFromBtcToCkbTx(): Promise<void>;
  leapFromCkbToBtcTx(): Promise<void>;
  btcTimeCellsSpentTx(): Promise<void>;
}
