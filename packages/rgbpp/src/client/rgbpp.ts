import { ccc } from '@ckb-ccc/core';

import { ICkbClient, CkbClient2, CkbWaitTransactionConfig, RgbppTokenInfo, CkbTxHash } from '@rgbpp-sdk/ckb';

import { IBtcClient, BtcClient2 } from '@rgbpp-sdk/btc';

import { RgbppClientConfig } from './types';

export class RgbppClient2 {
  constructor(
    private readonly ckbClient: ICkbClient,
    private readonly btcClient: IBtcClient,
  ) {}

  static create(config: RgbppClientConfig): RgbppClient2 {
    const ckbClient = CkbClient2.create(config.ckbNetwork, config.ckbPrivateKey, config.ckbJsonRpcUrl);
    const btcClient = BtcClient2.create(config.btcNetwork);

    return new RgbppClient2(ckbClient, btcClient);
  }

  async signAndSendCkbTransaction(
    tx: ccc.TransactionLike,
    config?: CkbWaitTransactionConfig,
  ): Promise<{
    txHash: CkbTxHash | string;
    res: ccc.ClientTransactionResponse | undefined;
  }> {
    return this.ckbClient.signAndSendTransaction(tx, config);
  }

  getBtcTestnetType() {
    return this.btcClient.getTestnetType();
  }

  generateRgbppLockScript(susBtcOutIndex: number, susBtcTxId: string) {
    return this.ckbClient.generateRgbppLockScript(susBtcOutIndex, susBtcTxId, this.getBtcTestnetType());
  }

  async xudtIssuancePreparationCkbTx(tokenInfo: RgbppTokenInfo, btcTxId: string, btcOutIdx: number) {
    return this.ckbClient.xudtIssuancePreparationTx(tokenInfo, btcTxId, btcOutIdx, this.getBtcTestnetType());
  }

  async xudtIssuanceCkbTx(
    tokenInfo: RgbppTokenInfo,
    amount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    feeRate?: bigint,
  ) {
    return this.ckbClient.xudtIssuanceTx(tokenInfo, amount, btcTxId, btcOutIdx, this.getBtcTestnetType(), feeRate);
  }
}
