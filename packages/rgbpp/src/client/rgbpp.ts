import { ccc } from '@ckb-ccc/core';

import { ICkbClient, createCkbClient, CkbWaitTransactionConfig, RgbppTokenInfo } from '@rgbpp-sdk/ckb';

import { IBtcClient, BtcClient2 } from '@rgbpp-sdk/btc';

import { RgbppClientConfig } from './types';

export class RgbppClient2 {
  constructor(
    private readonly ckbClient: ICkbClient,
    private readonly btcClient: IBtcClient,
  ) {}

  static create(config: RgbppClientConfig): RgbppClient2 {
    const ckbClient = createCkbClient(config.ckbNetwork, config.ckbPrivateKey);
    const btcClient = BtcClient2.create(config.btcNetwork);

    return new RgbppClient2(ckbClient, btcClient);
  }

  async signAndSendCkbTransaction(tx: ccc.TransactionLike, config?: CkbWaitTransactionConfig) {
    return this.ckbClient.signAndSendTransaction(tx, config);
  }

  getBtcTestnetType() {
    return this.btcClient.getTestnetType();
  }

  generateRgbppLockScript(susBtcOutIndex: number, susBtcTxId: string) {
    return this.ckbClient.generateRgbppLockScript(susBtcOutIndex, susBtcTxId, this.getBtcTestnetType());
  }

  async issuancePreparationCkbTx(tokenInfo: RgbppTokenInfo, btcTxId: string, btcOutIdx: number) {
    return this.ckbClient.issuancePreparationTx(tokenInfo, btcTxId, btcOutIdx, this.getBtcTestnetType());
  }
}
