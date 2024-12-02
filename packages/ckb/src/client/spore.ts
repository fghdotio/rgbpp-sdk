import { ccc } from '@ckb-ccc/core';
import { RawClusterData, RawSporeData } from '@spore-sdk/core';

import { ISporeTxBuilder } from './interfaces';

import { calculateRgbppClusterCellCapacity, buildRgbppLockArgs } from '../utils';
import { genCreateClusterCkbVirtualTx, genCreateSporeCkbVirtualTx, appendIssuerCellToSporesCreate } from '../spore';
import { Collector } from '../collector';
import { BTCTestnetType, SporeVirtualTxResult, SporeCreateVirtualTxResult, IndexerCell } from '../types';
import { RgbppApiSpvProof } from '@rgbpp-sdk/service';
import { updateCkbTxWithRealBtcTxId, appendCkbTxWitnesses } from '../rgbpp';
import { generateClusterCreateCoBuild, generateSporeCreateCoBuild } from '../utils';

export class SporeCkbTxBuilder implements ISporeTxBuilder {
  constructor(private isOnMainnet: boolean) {}

  clusterCellCapacity(clusterData: RawClusterData): bigint {
    return calculateRgbppClusterCellCapacity(clusterData);
  }

  clusterPreparationTx(clusterData: RawClusterData, rgbppLockScript: ccc.Script): ccc.Transaction {
    const clusterCellCapacity = this.clusterCellCapacity(clusterData);

    const tx = ccc.Transaction.from({
      outputs: [
        {
          lock: rgbppLockScript,
          capacity: clusterCellCapacity,
        },
      ],
    });
    return tx;
  }

  async clusterCreationTx(
    clusterData: RawClusterData,
    collector: Collector,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
    witnessLockPlaceholderSize?: number,
    feeRate?: bigint,
  ): Promise<SporeVirtualTxResult> {
    const rgbppOwnerLockArgs = buildRgbppLockArgs(btcOutIdx, btcTxId);

    return genCreateClusterCkbVirtualTx({
      collector,
      rgbppLockArgs: rgbppOwnerLockArgs,
      clusterData,
      isMainnet: this.isOnMainnet,
      btcTestnetType,
      witnessLockPlaceholderSize,
      ckbFeeRate: feeRate,
    });
  }

  async assembleClusterCreationCkbTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction> {
    const updatedRawTx = updateCkbTxWithRealBtcTxId({ ckbRawTx: rawTx, btcTxId, isMainnet: this.isOnMainnet });
    const ckbTx = await appendCkbTxWitnesses({
      ckbRawTx: updatedRawTx,
      btcTxBytes,
      rgbppApiSpvProof,
    });
    // Replace cobuild witness with the final rgbpp lock script
    ckbTx.witnesses[ckbTx.witnesses.length - 1] = generateClusterCreateCoBuild(ckbTx.outputs[0], ckbTx.outputsData[0]);

    return ckbTx;
  }

  async creationTx(
    collector: Collector,
    btcTxId: string,
    btcOutIdx: number,
    sporeData: RawSporeData[],
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<SporeCreateVirtualTxResult> {
    const clusterRgbppLockArgs = buildRgbppLockArgs(btcOutIdx, btcTxId);

    return genCreateSporeCkbVirtualTx({
      collector,
      clusterRgbppLockArgs,
      sporeDataList: sporeData,
      isMainnet: this.isOnMainnet,
      btcTestnetType,
      ckbFeeRate,
      witnessLockPlaceholderSize,
    });
  }

  async assembleCreationTx(
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
  ): Promise<CKBComponents.RawTransaction> {
    const updatedRawTx = updateCkbTxWithRealBtcTxId({ ckbRawTx: rawTx, btcTxId, isMainnet: this.isOnMainnet });
    const ckbTx = await appendCkbTxWitnesses({
      ckbRawTx: updatedRawTx,
      btcTxBytes,
      rgbppApiSpvProof,
    });
    // Replace cobuild witness with the final rgbpp lock script
    ckbTx.witnesses[ckbTx.witnesses.length - 1] = generateSporeCreateCoBuild({
      // The first output is cluster cell and the rest of the outputs are spore cells
      sporeOutputs: ckbTx.outputs.slice(1),
      sporeOutputsData: ckbTx.outputsData.slice(1),
      clusterCell,
      clusterOutputCell: ckbTx.outputs[0],
    });

    return appendIssuerCellToSporesCreate({
      secp256k1PrivateKey: ckbPrivateKey,
      issuerAddress: issuerCkbAddress,
      ckbRawTx: ckbTx,
      collector,
      sumInputsCapacity,
      isMainnet: this.isOnMainnet,
      ckbFeeRate,
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
