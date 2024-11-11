import { CkbNetwork, CkbClient } from '@rgbpp-sdk/ckb';

import { ccc } from '@ckb-ccc/core';

export class RgbppClient {
  private ckbClient: CkbClient;

  constructor(config: RgbppClientConfig) {
    this.ckbClient = new CkbClient(config.ckbNetwork, config.ckbPrivateKey);
  }

  static newCkbTransaction(tx: ccc.TransactionLike = {}) {
    return CkbClient.newTransaction(tx);
  }

  getCkbClient() {
    return this.ckbClient;
  }

  getCkbSigner() {
    return this.ckbClient.getSigner();
  }
}

type RgbppClientConfig = {
  ckbNetwork: CkbNetwork;
  // btcNetwork: BTCNetwork;
  ckbPrivateKey?: string;
};
