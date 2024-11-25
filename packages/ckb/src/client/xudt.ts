import { ccc } from '@ckb-ccc/core';

import { IXudtTxBuilder } from './interfaces';
import { RgbppTokenInfo } from '../types/rgbpp';
import { calculateRgbppCellCapacity, calculateRgbppTokenInfoCellCapacity } from '../utils/ckb-tx';
import { buildRgbppLockArgs, buildPreLockArgs } from '../utils/rgbpp';
import { BTCTestnetType } from '../types';
import { getRgbppLockScript } from '../constants';
import { genRgbppLaunchCkbVirtualTx } from '../rgbpp';
import { Collector } from '../collector';
import { RgbppLaunchVirtualTxResult } from '../types';
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

  async issuanceTx(
    collector: Collector,
    tokenInfo: RgbppTokenInfo,
    amount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    isOnMainnet: boolean,
    btcTestnetType: BTCTestnetType | undefined,
    feeRate?: bigint,
  ): Promise<RgbppLaunchVirtualTxResult> {
    const rgbppXudtOwnerLockArgs = buildRgbppLockArgs(btcOutIdx, btcTxId);
    return await genRgbppLaunchCkbVirtualTx({
      collector,
      ownerRgbppLockArgs: rgbppXudtOwnerLockArgs,
      rgbppTokenInfo: tokenInfo,
      launchAmount: amount,
      isMainnet: isOnMainnet,
      btcTestnetType,
      ckbFeeRate: feeRate,
    });
  }

  async transferTx() {
    throw new Error('Not implemented');
  }

  async batchTransferTx() {
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
