import { ccc } from '@ckb-ccc/core';

import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

import { IRpcClient, ISigner, IXudtTxBuilder, ISporePartialTxBuilder } from './interfaces';
import { CkbWaitTransactionConfig } from './types';

import { Collector } from '../collector';

import {
  BTCTestnetType,
  RgbppLaunchVirtualTxResult,
  RgbppBtcAddressReceiver,
  BtcBatchTransferVirtualTxResult,
  RgbppTokenInfo,
  BtcTransferVirtualTxResult,
  BtcJumpCkbVirtualTxResult,
} from '../types';
export class MockRpcClient implements IRpcClient {
  async waitTransaction(): Promise<ccc.ClientTransactionResponse | undefined> {
    return { status: 'committed', transaction: ccc.Transaction.from({}) };
  }
}

export class MockSigner implements ISigner {
  getSigner(): ccc.SignerCkbPrivateKey {
    return {} as ccc.SignerCkbPrivateKey;
  }

  async signAndSendTransaction(
    _: ccc.TransactionLike,
    config?: CkbWaitTransactionConfig,
  ): Promise<{ txHash: string; res: ccc.ClientTransactionResponse | undefined }> {
    return {
      txHash: '0x' + '0'.repeat(64),
      res: { status: 'committed', transaction: ccc.Transaction.from({}) },
    };
  }

  async sendTransaction(): Promise<string> {
    return '0x' + '0'.repeat(64);
  }
}

export class MockXudtPartialTxBuilder implements IXudtTxBuilder {
  async issuanceTx(): Promise<RgbppLaunchVirtualTxResult> {
    return {} as RgbppLaunchVirtualTxResult;
  }

  async transferTx(): Promise<BtcTransferVirtualTxResult> {
    return {} as BtcTransferVirtualTxResult;
  }

  async batchTransferTx(): Promise<BtcBatchTransferVirtualTxResult> {
    return {} as BtcBatchTransferVirtualTxResult;
  }

  async leapFromBtcToCkbTx(): Promise<BtcJumpCkbVirtualTxResult> {
    return {} as BtcJumpCkbVirtualTxResult;
  }

  async leapFromCkbToBtcTx(): Promise<CKBComponents.RawTransaction> {
    return {} as CKBComponents.RawTransaction;
  }

  async btcTimeCellsSpentTx(): Promise<void> {}

  issuanceCellCapacity(_: RgbppTokenInfo): bigint {
    return BigInt(0);
  }

  generateRgbppLockScript(_: number, btcTxId?: string, btcTestnetType?: BTCTestnetType): ccc.Script {
    return {} as ccc.Script;
  }

  issuancePreparationTx(
    rgbppTokenInfo: RgbppTokenInfo,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
  ): ccc.Transaction {
    return {} as ccc.Transaction;
  }

  async assembleIssuanceTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction> {
    return {} as CKBComponents.RawTransaction;
  }

  async assembleBatchTransferTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction> {
    return {} as CKBComponents.RawTransaction;
  }

  async assembleLeapFromCkbToBtcTx(
    ckbRawTx: CKBComponents.RawTransaction,
    collector: Collector,
    ckbPrivateKey: string,
  ): Promise<CKBComponents.RawTransaction> {
    return {} as CKBComponents.RawTransaction;
  }

  async assembleBtcTimeLockUnlockTx(
    ckbRawTx: CKBComponents.RawTransaction,
    privateKey: string,
    ckbAddress: string,
    collector: Collector,
  ): Promise<CKBComponents.RawTransaction> {
    return {} as CKBComponents.RawTransaction;
  }

  async btcTimeLockUnlockTx(): Promise<CKBComponents.RawTransaction> {
    return {} as CKBComponents.RawTransaction;
  }
}

export class MockSporePartialTxBuilder implements ISporePartialTxBuilder {
  async createClusterTx(): Promise<void> {}
  async creationTx(): Promise<void> {}
  async transferTx(): Promise<void> {}
  async leapFromBtcToCkbTx(): Promise<void> {}
  async leapFromCkbToBtcTx(): Promise<void> {}
  async btcTimeCellsSpentTx(): Promise<void> {}
}
