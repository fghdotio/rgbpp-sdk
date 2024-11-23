import { ccc } from '@ckb-ccc/core';

import { IRpcClient, ISigner, IXudtPartialTxBuilder, ISporePartialTxBuilder } from './interfaces';

export class MockRpcClient implements IRpcClient {
  async waitTransaction(): Promise<ccc.ClientTransactionResponse | undefined> {
    return { status: 'committed', transaction: ccc.Transaction.from({}) };
  }
}

export class MockSigner implements ISigner {
  async sendTransaction(): Promise<string> {
    return '0x' + '0'.repeat(64);
  }
}

export class MockXudtPartialTxBuilder implements IXudtPartialTxBuilder {
  async issuanceTx(): Promise<void> {}
  async transferTx(): Promise<void> {}
  async batchTransferTx(): Promise<void> {}
  async leapFromBtcToCkbTx(): Promise<void> {}
  async leapFromCkbToBtcTx(): Promise<void> {}
  async btcTimeCellsSpentTx(): Promise<void> {}
}

export class MockSporePartialTxBuilder implements ISporePartialTxBuilder {
  async createClusterTx(): Promise<void> {}
  async creationTx(): Promise<void> {}
  async transferTx(): Promise<void> {}
  async leapFromBtcToCkbTx(): Promise<void> {}
  async leapFromCkbToBtcTx(): Promise<void> {}
  async btcTimeCellsSpentTx(): Promise<void> {}
}
