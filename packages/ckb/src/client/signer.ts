import { ccc } from '@ckb-ccc/core';

import { ISigner } from './interfaces';
import { CkbWaitTransactionConfig, CkbTxHash } from './types';

export class CkbSigner implements ISigner {
  constructor(private signer: ccc.SignerCkbPrivateKey) {}

  getSigner() {
    return this.signer;
  }

  async signAndSendTransaction(
    tx: ccc.TransactionLike,
    config?: CkbWaitTransactionConfig,
  ): Promise<{
    txHash: CkbTxHash | string;
    res: ccc.ClientTransactionResponse | undefined;
  }> {
    const txHash = await this.signer.sendTransaction(tx);
    let res;
    if (config) {
      res = await this.signer.client.waitTransaction(txHash, config.confirmations, config.timeout, config.interval);
    } else {
      res = await this.signer.client.waitTransaction(txHash);
    }
    return {
      txHash,
      res,
    };
  }
}
