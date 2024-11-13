import { ccc } from '@ckb-ccc/core';

import { buildRgbppLockArgs, buildPreLockArgs } from '../utils';
import { getScriptInfo, ScriptName, CkbNetwork } from '../constants';

export class CkbClient {
  private network: CkbNetwork;
  private rpcClient: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet;
  private signer: ccc.Signer;

  constructor(ckbNetwork: CkbNetwork, ckbPrivateKey: string) {
    this.network = ckbNetwork;
    this.rpcClient = this.initRpcClient();
    this.signer = this.setSigner(ckbPrivateKey);
  }

  static newTransaction(tx: ccc.TransactionLike = {}) {
    return ccc.Transaction.from(tx);
  }

  getNetwork() {
    return this.network;
  }

  isOnMainnet() {
    return this.network === 'mainnet';
  }

  private initRpcClient(): ccc.ClientPublicMainnet | ccc.ClientPublicTestnet {
    return this.network === 'mainnet' ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();
  }

  private setSigner(ckbPrivateKey: string) {
    return new ccc.SignerCkbPrivateKey(this.rpcClient, ckbPrivateKey);
  }

  getRpcClient() {
    return this.rpcClient;
  }

  getSigner() {
    return this.signer;
  }

  getScriptInfo(scriptName: ScriptName) {
    return getScriptInfo(this.network, scriptName);
  }

  generateRgbppLockScript(btcOutIndex: number, btcTxId?: string) {
    let rgbppLockArgs: string;
    if (btcTxId) {
      rgbppLockArgs = buildRgbppLockArgs(btcOutIndex, btcTxId);
    } else {
      rgbppLockArgs = buildPreLockArgs(btcOutIndex);
    }
    const rgbppLockScriptInfo = this.getScriptInfo('RgbppLock');
    return ccc.Script.from({
      codeHash: rgbppLockScriptInfo.codeHash,
      hashType: rgbppLockScriptInfo.hashType,
      args: rgbppLockArgs,
    });
  }

  async sendTransaction(tx: ccc.TransactionLike, config?: CkbWaitTransactionConfig) {
    const txHash = await this.signer.sendTransaction(tx);
    let res;
    if (config) {
      res = await this.rpcClient.waitTransaction(txHash, config.confirmations, config.timeout, config.interval);
    } else {
      res = await this.rpcClient.waitTransaction(txHash);
    }
    return {
      txHash,
      res,
    };
  }

  async addCellDepsOfKnownScripts(tx: ccc.Transaction, knownScript: ccc.KnownScript) {
    await tx.addCellDepsOfKnownScripts(this.rpcClient, knownScript);
  }
}

export type CkbWaitTransactionConfig = {
  confirmations?: number;
  timeout?: number;
  interval?: number;
};
