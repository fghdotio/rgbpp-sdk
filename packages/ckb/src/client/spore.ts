import { ccc } from '@ckb-ccc/core';
import { RawClusterData } from '@spore-sdk/core';

import { ISporeTxBuilder } from './interfaces';

import { calculateRgbppClusterCellCapacity } from '../utils';

export class SporeCkbTxBuilder implements ISporeTxBuilder {
  constructor(private client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet) {}

  clusterCellCapacity(clusterData: RawClusterData): bigint {
    return calculateRgbppClusterCellCapacity(clusterData);
  }

  clusterCreationTx(clusterData: RawClusterData, rgbppLockScript: ccc.Script): ccc.Transaction {
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

  async transferTx() {
    throw new Error('Not implemented');
  }

  async leapFromBtcToCkbTx() {
    throw new Error('Not implemented');
  }

  async btcTimeCellsSpentTx() {
    throw new Error('Not implemented');
  }

  async creationTx() {
    throw new Error('Not implemented');
  }

  async leapFromCkbToBtcTx() {
    throw new Error('Not implemented');
  }
}
