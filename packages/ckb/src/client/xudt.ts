import { ccc } from '@ckb-ccc/core';

import { IXudtTxBuilder } from './interfaces';
import { RgbppTokenInfo } from '../types/rgbpp';
import { calculateRgbppCellCapacity, calculateRgbppTokenInfoCellCapacity } from '../utils/ckb-tx';
import { buildRgbppLockArgs, buildPreLockArgs } from '../utils/rgbpp';
import { BTCTestnetType } from '../types';
import { getRgbppLockScript, getXudtTypeScript } from '../constants';
import { genRgbppLaunchCkbVirtualTx, updateCkbTxWithRealBtcTxId, genBtcBatchTransferCkbVirtualTx } from '../rgbpp';
import { Collector } from '../collector';
import { RgbppLaunchVirtualTxResult } from '../types';
import { RgbppApiSpvProof } from '@rgbpp-sdk/service';
import { appendCkbTxWitnesses, appendIssuerCellToBtcBatchTransfer } from '../rgbpp';
import { RgbppBtcAddressReceiver, BtcBatchTransferVirtualTxResult } from '../types';

import {
  blake160,
  bytesToHex,
  privateKeyToPublicKey,
  scriptToAddress,
  systemScripts,
  serializeScript,
} from '@nervosnetwork/ckb-sdk-utils';

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

  async assembleXudtIssuanceTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction> {
    const updatedRawTx = updateCkbTxWithRealBtcTxId({ ckbRawTx: rawTx, btcTxId, isMainnet: this.isOnMainnet });
    return await appendCkbTxWitnesses({
      ckbRawTx: updatedRawTx,
      btcTxBytes,
      rgbppApiSpvProof,
    });
  }

  async assembleXudtBatchTransferTx(
    ckbRawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    ckbPrivateKey: string,
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

    const issuerAddress = scriptToAddress(
      {
        ...systemScripts.SECP256K1_BLAKE160,
        args: bytesToHex(blake160(privateKeyToPublicKey(ckbPrivateKey))),
      },
      this.isOnMainnet,
    );

    return appendIssuerCellToBtcBatchTransfer({
      secp256k1PrivateKey: ckbPrivateKey,
      issuerAddress,
      collector,
      ckbRawTx: ckbTxWithWitnesses,
      sumInputsCapacity,
      isMainnet: this.isOnMainnet,
      ckbFeeRate,
    });
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
    return await genRgbppLaunchCkbVirtualTx({
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

    return await genBtcBatchTransferCkbVirtualTx({
      collector,
      xudtTypeBytes,
      rgbppLockArgsList,
      rgbppReceivers,
      isMainnet: this.isOnMainnet,
      btcTestnetType,
    });
  }

  async transferTx() {
    throw new Error('Not implemented');
  }

  async leapFromBtcToCkbTx() {
    throw new Error('Not implemented');
  }

  async btcTimeCellsSpentTx() {
    throw new Error('Not implemented');
  }

  async leapFromCkbToBtcTx() {
    throw new Error('Not implemented');
  }
}
