import { ccc } from '@ckb-ccc/core';

import { CkbWaitTransactionConfig, CkbTxHash } from './types';
import { RgbppTokenInfo, BTCTestnetType } from '../types';
import { Collector } from '../collector';
import { RgbppXudtIssuanceResult } from './types';
import { RgbppLaunchVirtualTxResult, RgbppBtcAddressReceiver, BtcBatchTransferVirtualTxResult } from '../types';
import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

export interface ICkbClient {
  getCollector(): Collector;

  generateRgbppLockScript(outIndex: number, btcTxId?: string, btcTestnetType?: BTCTestnetType): ccc.Script;

  isOnMainnet(): boolean;

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

  assembleXudtIssuanceTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction>;

  assembleXudtBatchTransferTx(
    ckbRawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    ckbPrivateKey: string,
    collector: Collector,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
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

  transferTx(): Promise<void>;
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
