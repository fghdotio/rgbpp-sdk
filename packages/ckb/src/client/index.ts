import { ccc } from '@ckb-ccc/core';

import { CkbNetwork } from '../utils/ccc';
import { buildRgbppLockArgs } from '../utils/rgbpp';
import { getRgbppScriptInfo } from '../constants';

export class CkbClient {
  network: CkbNetwork;
  private client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet;
  private signer: ccc.Signer | undefined;
  rgbppScriptInfo: ccc.ScriptInfo;

  constructor(ckbNetwork: CkbNetwork, ckbPrivateKey?: string) {
    this.network = ckbNetwork;
    this.client = this.initClient();
    this.signer = this.initSigner(ckbPrivateKey);
    this.rgbppScriptInfo = getRgbppScriptInfo(ckbNetwork);
  }

  private initClient(): ccc.ClientPublicMainnet | ccc.ClientPublicTestnet {
    return this.network === 'mainnet' ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();
  }

  private initSigner(ckbPrivateKey?: string) {
    return ckbPrivateKey ? new ccc.SignerCkbPrivateKey(this.client, ckbPrivateKey) : undefined;
  }

  getClient() {
    return this.client;
  }

  getSigner() {
    return this.signer;
  }

  genRgbppLockScript(btcTxId: string, btcOutIndex: number) {
    const rgbppLockArgs = buildRgbppLockArgs(btcOutIndex, btcTxId);
    return ccc.Script.from({
      codeHash: this.rgbppScriptInfo.codeHash,
      hashType: this.rgbppScriptInfo.hashType,
      args: rgbppLockArgs,
    });
  }

  async addCellDepsOfKnownScripts(tx: ccc.Transaction, knownScript: ccc.KnownScript) {
    await tx.addCellDepsOfKnownScripts(this.client, knownScript);
  }

  static newTransaction(tx: ccc.TransactionLike = {}) {
    return ccc.Transaction.from(tx);
  }
}
