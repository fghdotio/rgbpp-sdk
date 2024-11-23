import { ccc } from '@ckb-ccc/core';

import { IRpcClient, ISigner, IXudtPartialTxBuilder, ISporePartialTxBuilder } from './interfaces';
import { CkbWaitTransactionConfig } from './types';

import { buildRgbppLockArgs, buildPreLockArgs } from '../utils';
import { CkbNetwork, getRgbppLockScript } from '../constants';
import { BTCTestnetType } from '../types';

export class CkbClient2 {
  constructor(
    private readonly network: CkbNetwork,
    private readonly rpcClient: IRpcClient,
    private readonly signer: ISigner,
    private readonly xudtPartialTxBuilder: IXudtPartialTxBuilder,
    private readonly sporePartialTxBuilder: ISporePartialTxBuilder,
  ) {}

  static newTransaction(tx: ccc.TransactionLike = {}) {
    return ccc.Transaction.from(tx);
  }

  getNetwork() {
    return this.network;
  }

  getRpcClient() {
    return this.rpcClient;
  }

  getSigner() {
    return this.signer;
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
    if (this.rpcClient instanceof CccRpcClientAdapter) {
      await tx.addCellDepsOfKnownScripts(this.rpcClient.client, knownScript);
    } else {
      throw new Error('Invalid RPC client type');
    }
  }

  generateRgbppLockScript(btcOutIndex: number, btcTxId?: string, btcTestnetType?: BTCTestnetType) {
    let rgbppLockArgs: string;
    if (btcTxId) {
      rgbppLockArgs = buildRgbppLockArgs(btcOutIndex, btcTxId);
    } else {
      rgbppLockArgs = buildPreLockArgs(btcOutIndex);
    }
    const rgbppLockScript = getRgbppLockScript(this.isOnMainnet(), btcTestnetType);
    return ccc.Script.from({
      ...rgbppLockScript,
      args: rgbppLockArgs,
    });
  }
}

export function createCkbClient(ckbNetwork: CkbNetwork, ckbPrivateKey: string): CkbClient2 {
  const cccClient = ckbNetwork === 'mainnet' ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();

  const rpcClient = new CccRpcClientAdapter(cccClient);
  const signer = new ccc.SignerCkbPrivateKey(cccClient, ckbPrivateKey);
  const xudtPartialTxBuilder = new XudtPartialCkbTxBuilder(cccClient);
  const sporePartialTxBuilder = new SporePartialCkbTxBuilder(cccClient);

  return new CkbClient2(ckbNetwork, rpcClient, signer, xudtPartialTxBuilder, sporePartialTxBuilder);
}

export class CccRpcClientAdapter implements IRpcClient {
  constructor(public client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet) {}

  async waitTransaction(
    txHash: string,
    confirmations?: number,
    timeout?: number,
    interval?: number,
  ): Promise<ccc.ClientTransactionResponse | undefined> {
    return this.client.waitTransaction(txHash, confirmations, timeout, interval);
  }
}

export class XudtPartialCkbTxBuilder implements IXudtPartialTxBuilder {
  constructor(private client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet) {}

  async issuanceTx() {
    throw new Error('Not implemented');
  }

  async transferTx() {
    throw new Error('Not implemented');
  }

  async batchTransferTx() {
    throw new Error('Not implemented');
  }

  async leapFromBtcToCkbTx() {
    throw new Error('Not implemented');
  }

  async btcTimeCellsSpentTx() {
    throw new Error('Not implemented');
  }

  async leapFromCkbToBtcTx() {
    throw new Error('Not implemented');
  }
}

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
