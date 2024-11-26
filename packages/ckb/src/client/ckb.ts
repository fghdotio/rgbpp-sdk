import { ccc } from '@ckb-ccc/core';

import { ICkbClient, IRpcClient, ISigner, IXudtTxBuilder, ISporePartialTxBuilder } from './interfaces';
import { CkbWaitTransactionConfig } from './types';
import { XudtCkbTxBuilder } from './xudt';
import { SporePartialCkbTxBuilder } from './spore';
import { CkbNetwork } from '../constants';
import { BTCTestnetType, RgbppTokenInfo } from '../types';
import { CkbSigner } from './signer';
import { CkbTxHash } from './types';
import { Collector } from '../collector';
import { RgbppXudtIssuanceResult } from './types';
import { RgbppApiSpvProof } from '@rgbpp-sdk/service';
import { sendCkbTx } from '../rgbpp';
export class CkbClient2 implements ICkbClient {
  constructor(
    private readonly network: CkbNetwork,
    private readonly rpcClient: IRpcClient,
    private readonly signer: ISigner,
    private readonly xudtTxBuilder: IXudtTxBuilder,
    private readonly sporePartialTxBuilder: ISporePartialTxBuilder,
    private explorerBaseUrl: string,

    private collector: Collector,
  ) {}

  static create(ckbNetwork: CkbNetwork, ckbPrivateKey: string, ckbJsonRpcUrl?: string): CkbClient2 {
    const isOnMainnet = ckbNetwork === 'mainnet';
    const rpcClient = isOnMainnet ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();

    const rpcClientAdapter = new CccRpcClientAdapter(rpcClient);
    const signer = new CkbSigner(new ccc.SignerCkbPrivateKey(rpcClient, ckbPrivateKey));
    const xudtTxBuilder = new XudtCkbTxBuilder(isOnMainnet);
    const sporePartialTxBuilder = new SporePartialCkbTxBuilder(rpcClient);
    const explorerBaseUrl = isOnMainnet ? 'https://explorer.nervos.org' : 'https://testnet.explorer.nervos.org';

    let jsonRpcUrl: string;
    if (ckbJsonRpcUrl) {
      jsonRpcUrl = ckbJsonRpcUrl;
    } else {
      jsonRpcUrl = isOnMainnet ? 'https://mainnet.ckb.dev/' : 'https://testnet.ckb.dev/';
    }
    // https://docs.nervos.org/docs/node/rpcs#public-json-rpc-nodes
    // also the indexer url
    const collector = new Collector({ ckbNodeUrl: jsonRpcUrl, ckbIndexerUrl: jsonRpcUrl });

    return new CkbClient2(
      ckbNetwork,
      rpcClientAdapter,
      signer,
      xudtTxBuilder,
      sporePartialTxBuilder,
      explorerBaseUrl,
      collector,
    );
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

  getCollector() {
    return this.collector;
  }

  async sendTransaction(tx: CKBComponents.RawTransaction): Promise<CkbTxHash> {
    const txHash = await sendCkbTx({ collector: this.collector, signedTx: tx });
    return new CkbTxHash(txHash, this.explorerBaseUrl);
  }

  async signAndSendTransaction(
    tx: ccc.TransactionLike,
    config?: CkbWaitTransactionConfig,
  ): Promise<{
    txHash: CkbTxHash | string;
    res: ccc.ClientTransactionResponse | undefined;
  }> {
    const { txHash, res } = await this.signer.signAndSendTransaction(tx, config);
    return {
      txHash: new CkbTxHash(txHash.toString(), this.explorerBaseUrl),
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

  generateRgbppLockScript(btcOutIndex: number, btcTxId?: string, btcTestnetType?: BTCTestnetType): ccc.Script {
    return this.xudtTxBuilder.generateRgbppLockScript(btcOutIndex, btcTxId, btcTestnetType);
  }

  async xudtIssuancePreparationTx(
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

  async assembleXudtFinalTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ) {
    return this.xudtTxBuilder.assembleXudtFinalTx(rawTx, btcTxId, btcTxBytes, rgbppApiSpvProof);
  }

  async xudtIssuanceTx(
    tokenInfo: RgbppTokenInfo,
    amount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType: BTCTestnetType,
    feeRate?: bigint,
  ): Promise<RgbppXudtIssuanceResult> {
    const res = await this.xudtTxBuilder.issuanceTx(
      this.collector,
      tokenInfo,
      amount,
      btcTxId,
      btcOutIdx,
      this.isOnMainnet(),
      btcTestnetType,
      feeRate,
    );

    const typeArgs = res.ckbRawTx.outputs[0].type?.args;
    if (!typeArgs) {
      throw new Error('Expected type args in first output of issuance transaction');
    }

    return {
      rgbppLaunchVirtualTxResult: res,
      rgbppXudtUniqueId: typeArgs,
    };
  }
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
