import { ccc } from '@ckb-ccc/core';
import { RawClusterData, RawSporeData } from '@spore-sdk/core';

import { RgbppApiSpvProof, BtcAssetsApi } from '@rgbpp-sdk/service';

import { CkbWaitTransactionConfig, CkbTxHash, RgbppXudtIssuanceResult } from './types';

import {
  RgbppTokenInfo,
  BTCTestnetType,
  RgbppLaunchVirtualTxResult,
  RgbppBtcAddressReceiver,
  BtcBatchTransferVirtualTxResult,
  BtcTransferVirtualTxResult,
  BtcJumpCkbVirtualTxResult,
  SporeVirtualTxResult,
  SporeCreateVirtualTxResult,
  IndexerCell,
} from '../types';
import { Collector } from '../collector';

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

  assembleXudtLeapFromCkbToBtcTx(ckbRawTx: CKBComponents.RawTransaction): Promise<CKBComponents.RawTransaction>;

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

  xudtTransferTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    transferAmount: bigint,
    btcTestnetType: BTCTestnetType | undefined,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcTransferVirtualTxResult>;

  xudtBatchTransferTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    rgbppReceivers: RgbppBtcAddressReceiver[],
    btcTestnetType: BTCTestnetType | undefined,
  ): Promise<BtcBatchTransferVirtualTxResult>;

  xudtLeapFromBtcToCkbTx(
    xudtTypeArgs: string,
    toCkbAddress: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    leapAmount: bigint,
    btcTestnetType?: BTCTestnetType,
    btcConfirmationBlocks?: number,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcJumpCkbVirtualTxResult>;

  xudtLeapFromCkbToBtcTx(
    xudtTypeArgs: string,
    leapAmount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<CKBComponents.RawTransaction>;

  assembleXudtBtcTimeLockUnlockTx(ckbRawTx: CKBComponents.RawTransaction): Promise<CKBComponents.RawTransaction>;

  xudtBtcTimeLockUnlockTx(
    btcTimeLockScriptArgs: string,
    btcAssetsApi: BtcAssetsApi,
    btcTestnetType?: BTCTestnetType,
  ): Promise<CKBComponents.RawTransaction>;

  sporeClusterPreparationTx(
    clusterData: RawClusterData,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
  ): Promise<ccc.Transaction>;

  sporeClusterCreationTx(
    clusterData: RawClusterData,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
    feeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<SporeVirtualTxResult>;

  assembleSporeClusterCreationTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction>;

  sporeCreationTx(
    btcTxId: string,
    btcOutIdx: number,
    sporeData: RawSporeData[],
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<SporeCreateVirtualTxResult>;

  assembleSporeCreationTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    clusterCell: IndexerCell,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction>;
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
  generateXudtTypeScript(xudtTypeArgs: string): CKBComponents.Script;
  issuancePreparationTx(tokenInfo: RgbppTokenInfo, rgbppLockScript: ccc.Script): ccc.Transaction;

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

  leapFromBtcToCkbTx(
    collector: Collector,
    xudtTypeArgs: string,
    toCkbAddress: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    leapAmount: bigint,
    btcTestnetType?: BTCTestnetType,
    btcConfirmationBlocks?: number,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcJumpCkbVirtualTxResult>;

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

  btcTimeLockUnlockTx(
    lockScriptArgs: string,
    collector: Collector,
    btcAssetsApi: BtcAssetsApi,
    btcTestnetType?: BTCTestnetType,
  ): Promise<CKBComponents.RawTransaction>;

  assembleBtcTimeLockUnlockTx(
    ckbRawTx: CKBComponents.RawTransaction,
    privateKey: string,
    ckbAddress: string,
    collector: Collector,
  ): Promise<CKBComponents.RawTransaction>;
}

export interface ISporeTxBuilder {
  clusterCellCapacity(clusterData: RawClusterData): bigint;

  clusterPreparationTx(clusterData: RawClusterData, rgbppLockScript: ccc.Script): ccc.Transaction;

  clusterCreationTx(
    clusterData: RawClusterData,
    collector: Collector,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
    witnessLockPlaceholderSize?: number,
    feeRate?: bigint,
  ): Promise<SporeVirtualTxResult>;

  assembleClusterCreationCkbTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction>;

  creationTx(
    collector: Collector,
    btcTxId: string,
    btcOutIdx: number,
    sporeData: RawSporeData[],
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<SporeCreateVirtualTxResult>;

  assembleCreationTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    clusterCell: IndexerCell,
    sumInputsCapacity: string,
    collector: Collector,
    ckbPrivateKey: string,
    issuerCkbAddress: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction>;

  transferTx(): Promise<void>;
  leapFromBtcToCkbTx(): Promise<void>;
  leapFromCkbToBtcTx(): Promise<void>;
  btcTimeCellsSpentTx(): Promise<void>;
}
