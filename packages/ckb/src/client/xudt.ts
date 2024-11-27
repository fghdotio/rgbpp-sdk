import { ccc } from '@ckb-ccc/core';
import { serializeScript } from '@nervosnetwork/ckb-sdk-utils';

import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

import {
  BTCTestnetType,
  RgbppLaunchVirtualTxResult,
  RgbppBtcAddressReceiver,
  BtcBatchTransferVirtualTxResult,
  RgbppTokenInfo,
  BtcTransferVirtualTxResult,
} from '../types';
import {
  calculateRgbppCellCapacity,
  calculateRgbppTokenInfoCellCapacity,
  buildRgbppLockArgs,
  buildPreLockArgs,
} from '../utils';
import { getRgbppLockScript, getXudtTypeScript, getSecp256k1CellDep } from '../constants';
import {
  genRgbppLaunchCkbVirtualTx,
  updateCkbTxWithRealBtcTxId,
  genBtcBatchTransferCkbVirtualTx,
  appendCkbTxWitnesses,
  appendIssuerCellToBtcBatchTransfer,
  genCkbJumpBtcVirtualTx,
  genBtcTransferCkbVirtualTx,
} from '../rgbpp';
import { Collector } from '../collector';

import { IXudtTxBuilder } from './interfaces';

export class XudtCkbTxBuilder implements IXudtTxBuilder {
  constructor(private isOnMainnet: boolean) {}

  issuanceCellCapacity(tokenInfo: RgbppTokenInfo) {
    return calculateRgbppCellCapacity() + calculateRgbppTokenInfoCellCapacity(tokenInfo, this.isOnMainnet);
  }

  generateRgbppLockScript(btcOutIndex: number, btcTxId?: string, btcTestnetType?: BTCTestnetType) {
    let rgbppLockArgs: string;
    if (btcTxId) {
      rgbppLockArgs = buildRgbppLockArgs(btcOutIndex, btcTxId);
    } else {
      rgbppLockArgs = buildPreLockArgs(btcOutIndex);
    }
    const rgbppLockScript = getRgbppLockScript(this.isOnMainnet, btcTestnetType);
    return ccc.Script.from({
      ...rgbppLockScript,
      args: rgbppLockArgs,
    });
  }

  generateXudtTypeScript(xudtTypeArgs: string): CKBComponents.Script {
    return {
      ...getXudtTypeScript(this.isOnMainnet),
      args: xudtTypeArgs,
    };
  }

  issuancePreparationTx(
    tokenInfo: RgbppTokenInfo,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
  ): ccc.Transaction {
    const issuanceCellCapacity = this.issuanceCellCapacity(tokenInfo);

    const tx = ccc.Transaction.from({
      outputs: [
        {
          lock: this.generateRgbppLockScript(btcOutIdx, btcTxId, btcTestnetType),
          capacity: issuanceCellCapacity,
        },
      ],
    });
    return tx;
  }

  async assembleIssuanceTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction> {
    const updatedRawTx = updateCkbTxWithRealBtcTxId({ ckbRawTx: rawTx, btcTxId, isMainnet: this.isOnMainnet });
    return appendCkbTxWitnesses({
      ckbRawTx: updatedRawTx,
      btcTxBytes,
      rgbppApiSpvProof,
    });
  }

  async assembleBatchTransferTx(
    ckbRawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    ckbPrivateKey: string,
    issuerCkbAddress: string,
    collector: Collector,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction> {
    const ckbTxWithBtcId = updateCkbTxWithRealBtcTxId({ ckbRawTx: ckbRawTx, btcTxId, isMainnet: this.isOnMainnet });
    const ckbTxWithWitnesses = await appendCkbTxWitnesses({
      ckbRawTx: ckbTxWithBtcId,
      btcTxBytes,
      rgbppApiSpvProof,
    });

    return appendIssuerCellToBtcBatchTransfer({
      secp256k1PrivateKey: ckbPrivateKey,
      issuerAddress: issuerCkbAddress,
      collector,
      ckbRawTx: ckbTxWithWitnesses,
      sumInputsCapacity,
      isMainnet: this.isOnMainnet,
      ckbFeeRate,
    });
  }

  async assembleLeapFromCkbToBtcTx(
    ckbRawTx: CKBComponents.RawTransaction,
    collector: Collector,
    ckbPrivateKey: string,
  ): Promise<CKBComponents.RawTransaction> {
    const emptyWitness = { lock: '', inputType: '', outputType: '' };
    const unsignedTx: CKBComponents.RawTransactionToSign = {
      ...ckbRawTx,
      cellDeps: [...ckbRawTx.cellDeps, getSecp256k1CellDep(this.isOnMainnet)],
      witnesses: [emptyWitness, ...ckbRawTx.witnesses.slice(1)],
    };
    const signedTx = collector.getCkb().signTransaction(ckbPrivateKey)(unsignedTx);

    return signedTx;
  }

  async issuanceTx(
    collector: Collector,
    tokenInfo: RgbppTokenInfo,
    amount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType: BTCTestnetType | undefined,
    feeRate?: bigint,
  ): Promise<RgbppLaunchVirtualTxResult> {
    const rgbppXudtOwnerLockArgs = buildRgbppLockArgs(btcOutIdx, btcTxId);
    return genRgbppLaunchCkbVirtualTx({
      collector,
      ownerRgbppLockArgs: rgbppXudtOwnerLockArgs,
      rgbppTokenInfo: tokenInfo,
      launchAmount: amount,
      isMainnet: this.isOnMainnet,
      btcTestnetType,
      ckbFeeRate: feeRate,
    });
  }

  async batchTransferTx(
    collector: Collector,
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    rgbppReceivers: RgbppBtcAddressReceiver[],
    btcTestnetType: BTCTestnetType | undefined,
  ): Promise<BtcBatchTransferVirtualTxResult> {
    const rgbppLockArgsList = btcOutpoints.map(({ btcTxId, btcOutIdx }) => buildRgbppLockArgs(btcOutIdx, btcTxId));

    const xudtTypeBytes = serializeScript(this.generateXudtTypeScript(xudtTypeArgs));

    return genBtcBatchTransferCkbVirtualTx({
      collector,
      xudtTypeBytes,
      rgbppLockArgsList,
      rgbppReceivers,
      isMainnet: this.isOnMainnet,
      btcTestnetType,
    });
  }

  async transferTx(
    collector: Collector,
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    transferAmount: bigint,
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcTransferVirtualTxResult> {
    const rgbppLockArgsList = btcOutpoints.map(({ btcTxId, btcOutIdx }) => buildRgbppLockArgs(btcOutIdx, btcTxId));

    return genBtcTransferCkbVirtualTx({
      collector,
      xudtTypeBytes: serializeScript(this.generateXudtTypeScript(xudtTypeArgs)),
      rgbppLockArgsList,
      transferAmount,
      isMainnet: this.isOnMainnet,
      btcTestnetType,
      ckbFeeRate,
      noMergeOutputCells,
      witnessLockPlaceholderSize,
    });
  }

  async leapFromBtcToCkbTx() {
    throw new Error('Not implemented');
  }

  async btcTimeCellsSpentTx() {
    throw new Error('Not implemented');
  }

  async leapFromCkbToBtcTx(
    collector: Collector,
    xudtTypeArgs: string,
    fromCkbAddress: string,
    btcTxId: string,
    btcOutIdx: number,
    leapAmount: bigint,
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<CKBComponents.RawTransaction> {
    const rgbppXudtOwnerLockArgs = buildRgbppLockArgs(btcOutIdx, btcTxId);

    return genCkbJumpBtcVirtualTx({
      collector,
      fromCkbAddress,
      toRgbppLockArgs: rgbppXudtOwnerLockArgs,
      xudtTypeBytes: serializeScript(this.generateXudtTypeScript(xudtTypeArgs)),
      transferAmount: leapAmount,
      witnessLockPlaceholderSize,
      btcTestnetType,
      ckbFeeRate,
    });
  }
}
