import { ccc } from '@ckb-ccc/core';

import { ICkbClient, IRpcClient, ISigner, IXudtTxBuilder, ISporePartialTxBuilder } from './interfaces';
import { CkbWaitTransactionConfig } from './types';
import { XudtCkbTxBuilder } from './xudt';
import { SporePartialCkbTxBuilder } from './spore';
import { CkbNetwork } from '../constants';
import { BTCTestnetType, RgbppTokenInfo } from '../types';
import { CkbSigner } from './signer';
export class CkbClient2 implements ICkbClient {
  constructor(
    private readonly network: CkbNetwork,
    private readonly rpcClient: IRpcClient,
    private readonly signer: ISigner,
    private readonly xudtTxBuilder: IXudtTxBuilder,
    private readonly sporePartialTxBuilder: ISporePartialTxBuilder,
  ) {}

  newTransaction(tx: ccc.TransactionLike = {}) {
    return ccc.Transaction.from(tx);
  }

  getNetwork() {
    return this.network;
  }

  private getSigner() {
    return this.signer.getSigner();
  }

  getXudtPartialTxBuilder() {
    return this.xudtTxBuilder;
  }

  getSporePartialTxBuilder() {
    return this.sporePartialTxBuilder;
  }

  isOnMainnet() {
    return this.network === 'mainnet';
  }

  async signAndSendTransaction(tx: ccc.TransactionLike, config?: CkbWaitTransactionConfig) {
    return this.signer.signAndSendTransaction(tx, config);
  }

  async addCellDepsOfKnownScripts(tx: ccc.Transaction, knownScript: ccc.KnownScript) {
    if (this.rpcClient instanceof CccRpcClientAdapter) {
      await tx.addCellDepsOfKnownScripts(this.rpcClient.client, knownScript);
    } else {
      throw new Error('Invalid RPC client type');
    }
  }

  generateRgbppLockScript(btcOutIndex: number, btcTxId?: string, btcTestnetType?: BTCTestnetType): ccc.Script {
    return this.xudtTxBuilder.generateRgbppLockScript(btcOutIndex, btcTxId, btcTestnetType);
  }

  async issuancePreparationTx(
    tokenInfo: RgbppTokenInfo,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
  ): Promise<ccc.Transaction> {
    const tx = this.xudtTxBuilder.issuancePreparationTx(tokenInfo, btcTxId, btcOutIdx, btcTestnetType);

    await tx.completeInputsByCapacity(this.getSigner(), 0, {
      scriptLenRange: [0, 1],
      outputDataLenRange: [0, 1],
    });
    await tx.completeFeeBy(this.getSigner());

    return tx;
  }
}

export function createCkbClient(ckbNetwork: CkbNetwork, ckbPrivateKey: string): CkbClient2 {
  const isOnMainnet = ckbNetwork === 'mainnet';
  const rpcClient = isOnMainnet ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();

  const rpcClientAdapter = new CccRpcClientAdapter(rpcClient);
  const signer = new CkbSigner(new ccc.SignerCkbPrivateKey(rpcClient, ckbPrivateKey));
  const xudtTxBuilder = new XudtCkbTxBuilder(isOnMainnet);
  const sporePartialTxBuilder = new SporePartialCkbTxBuilder(rpcClient);

  return new CkbClient2(ckbNetwork, rpcClientAdapter, signer, xudtTxBuilder, sporePartialTxBuilder);
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
