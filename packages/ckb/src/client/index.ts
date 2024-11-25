import { ccc } from '@ckb-ccc/core';

import { buildRgbppLockArgs, buildPreLockArgs } from '../utils';
import { getScriptInfo, ScriptName, CkbNetwork } from '../constants';

export class CkbClient {
  private network: CkbNetwork;
  private rpcClient: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet;
  private signer: ccc.Signer;
  private xudtPartialTxBuilder: XudtPartialCkbTxBuilder;
  private sporePartialTxBuilder: SporePartialCkbTxBuilder;

  constructor(ckbNetwork: CkbNetwork, ckbPrivateKey: string) {
    this.network = ckbNetwork;
    this.rpcClient = this.initRpcClient();
    this.signer = this.setSigner(ckbPrivateKey);
    this.xudtPartialTxBuilder = new XudtPartialCkbTxBuilder(this.rpcClient);
    this.sporePartialTxBuilder = new SporePartialCkbTxBuilder(this.rpcClient);
  }

  static newTransaction(tx: ccc.TransactionLike = {}) {
    return ccc.Transaction.from(tx);
  }

  static calculateCommitment() {}

  getRpcClient() {
    return this.rpcClient;
  }

  getNetwork() {
    return this.network;
  }

  getXudtPartialTxBuilder() {
    return this.xudtPartialTxBuilder;
  }

  getSporePartialTxBuilder() {
    return this.sporePartialTxBuilder;
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

export class XudtPartialCkbTxBuilder {
  private client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet;

  constructor(rpcClient: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet) {
    this.client = rpcClient;
  }

  async issuanceTx() {
    console.log(this.client);
  }

  async transferTx() {}

  async batchTransferTx() {}

  async leapFromBtcToCkbTx() {}

  async leapFromCkbToBtcTx() {}

  async btcTimeCellsSpentTx() {}
}

export class SporePartialCkbTxBuilder {
  private client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet;

  constructor(rpcClient: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet) {
    this.client = rpcClient;
  }

  async createClusterTx() {
    console.log(this.client);
  }

  async creationTx() {}

  async transferTx() {}

  async leapFromBtcToCkbTx() {}

  async leapFromCkbToBtcTx() {}

  async btcTimeCellsSpentTx() {}
}

export * from './ckb';
export * from './interfaces';
export * from './types';
