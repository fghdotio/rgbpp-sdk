import { ccc } from '@ckb-ccc/core';

import { ISporePartialTxBuilder } from './interfaces';

export class SporePartialCkbTxBuilder implements ISporePartialTxBuilder {
  constructor(private client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet) {}

  async createClusterTx() {
    throw new Error('Not implemented');
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
