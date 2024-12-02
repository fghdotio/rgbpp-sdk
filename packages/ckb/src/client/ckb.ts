import { ccc } from '@ckb-ccc/core';
import {
  blake160,
  bytesToHex,
  privateKeyToPublicKey,
  scriptToAddress,
  systemScripts,
} from '@nervosnetwork/ckb-sdk-utils';

import { RgbppApiSpvProof, BtcAssetsApi } from '@rgbpp-sdk/service';

import { ICkbClient, IRpcClient, ISigner, IXudtTxBuilder, ISporePartialTxBuilder } from './interfaces';
import { CkbWaitTransactionConfig, CkbTxHash, RgbppXudtIssuanceResult } from './types';
import { XudtCkbTxBuilder } from './xudt';
import { SporePartialCkbTxBuilder } from './spore';
import { CkbSigner } from './signer';

import { CkbNetwork, getRgbppLockScript } from '../constants';
import { Collector } from '../collector';
import { sendCkbTx } from '../rgbpp';
import {
  BTCTestnetType,
  RgbppTokenInfo,
  RgbppBtcAddressReceiver,
  BtcBatchTransferVirtualTxResult,
  BtcTransferVirtualTxResult,
  BtcJumpCkbVirtualTxResult,
} from '../types';
import { buildRgbppLockArgs, buildPreLockArgs } from '../utils';

export class CkbClient2 implements ICkbClient {
  constructor(
    private readonly network: CkbNetwork,
    private readonly rpcClient: IRpcClient,
    private readonly signer: ISigner,
    private readonly xudtTxBuilder: IXudtTxBuilder,
    private readonly sporePartialTxBuilder: ISporePartialTxBuilder,
    private explorerBaseUrl: string,
    private privateKey: string,
    private ckbAddress: string,

    private collector: Collector,
  ) {}

  static create(ckbNetwork: CkbNetwork, ckbPrivateKey: string, ckbJsonRpcUrl?: string): CkbClient2 {
    const isOnMainnet = ckbNetwork === 'mainnet';
    const rpcClient = isOnMainnet ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();

    const rpcClientAdapter = new CccRpcClientAdapter(rpcClient);
    const signer = new CkbSigner(new ccc.SignerCkbPrivateKey(rpcClient, ckbPrivateKey));
    const ckbAddress = scriptToAddress(
      {
        ...systemScripts.SECP256K1_BLAKE160,
        args: bytesToHex(blake160(privateKeyToPublicKey(ckbPrivateKey))),
      },
      isOnMainnet,
    );
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
      ckbPrivateKey,
      ckbAddress,
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

  newCkbTxHash(txHash: string): CkbTxHash {
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

  async xudtIssuancePreparationTx(
    tokenInfo: RgbppTokenInfo,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
  ): Promise<ccc.Transaction> {
    const rgbppLockScript = this.generateRgbppLockScript(btcOutIdx, btcTxId, btcTestnetType);

    const tx = this.xudtTxBuilder.issuancePreparationTx(tokenInfo, rgbppLockScript);

    await tx.completeInputsByCapacity(this.getSigner(), 0, {
      scriptLenRange: [0, 1],
      outputDataLenRange: [0, 1],
    });
    await tx.completeFeeBy(this.getSigner());

    return tx;
  }

  async assembleXudtIssuanceTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ) {
    return this.xudtTxBuilder.assembleIssuanceTx(rawTx, btcTxId, btcTxBytes, rgbppApiSpvProof);
  }

  async assembleXudtBatchTransferTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction> {
    return this.xudtTxBuilder.assembleBatchTransferTx(
      rawTx,
      btcTxId,
      btcTxBytes,
      rgbppApiSpvProof,
      this.privateKey,
      this.ckbAddress,
      this.collector,
      sumInputsCapacity,
      ckbFeeRate,
    );
  }

  async assembleXudtLeapFromCkbToBtcTx(ckbRawTx: CKBComponents.RawTransaction): Promise<CKBComponents.RawTransaction> {
    return this.xudtTxBuilder.assembleLeapFromCkbToBtcTx(ckbRawTx, this.collector, this.privateKey);
  }

  async xudtBtcTimeLockUnlockTx(
    btcTimeLockScriptArgs: string,
    btcAssetsApi: BtcAssetsApi,
    btcTestnetType?: BTCTestnetType,
  ): Promise<CKBComponents.RawTransaction> {
    return this.xudtTxBuilder.btcTimeLockUnlockTx(btcTimeLockScriptArgs, this.collector, btcAssetsApi, btcTestnetType);
  }

  async assembleXudtBtcTimeLockUnlockTx(ckbRawTx: CKBComponents.RawTransaction): Promise<CKBComponents.RawTransaction> {
    return this.xudtTxBuilder.assembleBtcTimeLockUnlockTx(ckbRawTx, this.privateKey, this.ckbAddress, this.collector);
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

  async xudtTransferTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    transferAmount: bigint,
    btcTestnetType: BTCTestnetType | undefined,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcTransferVirtualTxResult> {
    return this.xudtTxBuilder.transferTx(
      this.collector,
      xudtTypeArgs,
      btcOutpoints,
      transferAmount,
      btcTestnetType,
      ckbFeeRate,
      noMergeOutputCells,
      witnessLockPlaceholderSize,
    );
  }

  async xudtBatchTransferTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    rgbppReceivers: RgbppBtcAddressReceiver[],
    btcTestnetType: BTCTestnetType | undefined,
  ): Promise<BtcBatchTransferVirtualTxResult> {
    return this.xudtTxBuilder.batchTransferTx(
      this.collector,
      xudtTypeArgs,
      btcOutpoints,
      rgbppReceivers,
      btcTestnetType,
    );
  }

  async xudtLeapFromCkbToBtcTx(
    xudtTypeArgs: string,
    leapAmount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    btcTestnetType?: BTCTestnetType,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<CKBComponents.RawTransaction> {
    return this.xudtTxBuilder.leapFromCkbToBtcTx(
      this.collector,
      xudtTypeArgs,
      this.ckbAddress,
      btcTxId,
      btcOutIdx,
      leapAmount,
      btcTestnetType,
      ckbFeeRate,
      witnessLockPlaceholderSize,
    );
  }

  async xudtLeapFromBtcToCkbTx(
    xudtTypeArgs: string,
    toCkbAddress: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    leapAmount: bigint,
    btcTestnetType?: BTCTestnetType,
    btcConfirmationBlocks?: number,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcJumpCkbVirtualTxResult> {
    return this.xudtTxBuilder.leapFromBtcToCkbTx(
      this.collector,
      xudtTypeArgs,
      toCkbAddress,
      btcOutpoints,
      leapAmount,
      btcTestnetType,
      btcConfirmationBlocks,
      ckbFeeRate,
      noMergeOutputCells,
      witnessLockPlaceholderSize,
    );
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
