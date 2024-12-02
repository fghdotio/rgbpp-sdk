import { ccc } from '@ckb-ccc/core';

import {
  ICkbClient,
  CkbClient2,
  CkbWaitTransactionConfig,
  RgbppTokenInfo,
  CkbTxHash,
  RgbppXudtIssuanceResult,
  RgbppBtcAddressReceiver,
  BtcBatchTransferVirtualTxResult,
  BtcTransferVirtualTxResult,
  BtcJumpCkbVirtualTxResult,
  RawClusterData,
  RawSporeData,
  IndexerCell,
} from '@rgbpp-sdk/ckb';

import { IBtcClient, BtcClient2, bitcoin, RgbppUtxoProps, BtcTxHash } from '@rgbpp-sdk/btc';

import {
  RgbppApiSpvProof,
  RgbppApiTransactionState,
  RgbppApiTransactionStateParams,
  RgbppApiSendCkbVirtualResult,
} from '@rgbpp-sdk/service';

import { RgbppClientConfig } from './types';
import { TransferAllTxsParams } from './interfaces';
import { RgbppTransferAllTxsResult } from '../rgbpp/types/xudt';
import { buildRgbppTransferAllTxs } from '../rgbpp/xudt/btc-transfer-all';

export class RgbppClient2 {
  constructor(
    private readonly ckbClient: ICkbClient,
    private readonly btcClient: IBtcClient,
    private readonly _isOnMainnet: boolean,
  ) {}

  static create(config: RgbppClientConfig): RgbppClient2 {
    const ckbClient = CkbClient2.create(config.ckbNetwork, config.ckbPrivateKey, config.ckbJsonRpcUrl);
    const btcClient = BtcClient2.create(config.btcNetwork, config.btcAssetsApiConfig, config.btcAccountConfig);
    if (ckbClient.isOnMainnet() !== btcClient.isOnMainnet()) {
      throw new Error('CKB and BTC networks mismatch!');
    }

    return new RgbppClient2(ckbClient, btcClient, ckbClient.isOnMainnet());
  }

  isOnMainnet() {
    return this._isOnMainnet;
  }

  async sendCkbTransaction(tx: CKBComponents.RawTransaction): Promise<CkbTxHash> {
    return this.ckbClient.sendTransaction(tx);
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

  async sporeClusterPreparationCkbTx(clusterData: RawClusterData, btcTxId: string, btcOutIdx: number) {
    return this.ckbClient.sporeClusterPreparationTx(clusterData, btcTxId, btcOutIdx, this.getBtcTestnetType());
  }

  async sporeClusterCreationCkbTx(
    clusterData: RawClusterData,
    btcTxId: string,
    btcOutIdx: number,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ) {
    return this.ckbClient.sporeClusterCreationTx(
      clusterData,
      btcTxId,
      btcOutIdx,
      this.getBtcTestnetType(),
      ckbFeeRate,
      witnessLockPlaceholderSize,
    );
  }

  async assembleSporeClusterCreationCkbTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string | BtcTxHash,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.ckbClient.assembleSporeClusterCreationTx(rawTx, btcTxId, btcTxBytes, rgbppApiSpvProof);
  }

  async sporeCreationCkbTx(
    btcTxId: string,
    btcOutIdx: number,
    sporeData: RawSporeData[],
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ) {
    return this.ckbClient.sporeCreationTx(
      btcTxId,
      btcOutIdx,
      sporeData,
      this.getBtcTestnetType(),
      ckbFeeRate,
      witnessLockPlaceholderSize,
    );
  }

  async assembleSporeCreationCkbTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string | BtcTxHash,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    clusterCell: IndexerCell,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.ckbClient.assembleSporeCreationTx(
      rawTx,
      btcTxId,
      btcTxBytes,
      rgbppApiSpvProof,
      clusterCell,
      sumInputsCapacity,
      ckbFeeRate,
    );
  }

  async sporeTransferCkbTx(
    btcTxId: string,
    btcOutIdx: number,
    sporeTypeArgs: string,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ) {
    return this.ckbClient.sporeTransferTx(
      btcTxId,
      btcOutIdx,
      sporeTypeArgs,
      this.getBtcTestnetType(),
      ckbFeeRate,
      witnessLockPlaceholderSize,
    );
  }

  async sporeLeapFromBtcToCkbCkbTx(
    btcTxId: string,
    btcOutIdx: number,
    sporeTypeArgs: string,
    toCkbAddress: string,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ) {
    return this.ckbClient.sporeLeapFromBtcToCkbTx(
      btcTxId,
      btcOutIdx,
      sporeTypeArgs,
      toCkbAddress,
      this.getBtcTestnetType(),
      ckbFeeRate,
      witnessLockPlaceholderSize,
    );
  }

  async assembleXudtIssuanceCkbTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string | BtcTxHash,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
  ): Promise<CKBComponents.RawTransaction> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.ckbClient.assembleXudtIssuanceTx(rawTx, btcTxId, btcTxBytes, rgbppApiSpvProof);
  }

  async assembleXudtBatchTransferCkbTx(
    rawTx: CKBComponents.RawTransaction,
    btcTxId: string | BtcTxHash,
    btcTxBytes: string,
    rgbppApiSpvProof: RgbppApiSpvProof,
    sumInputsCapacity: string,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.ckbClient.assembleXudtBatchTransferTx(
      rawTx,
      btcTxId,
      btcTxBytes,
      rgbppApiSpvProof,
      sumInputsCapacity,
      ckbFeeRate,
    );
  }

  async assembleXudtLeapFromCkbToBtcCkbTx(
    ckbRawTx: CKBComponents.RawTransaction,
  ): Promise<CKBComponents.RawTransaction> {
    return this.ckbClient.assembleXudtLeapFromCkbToBtcTx(ckbRawTx);
  }

  async xudtIssuanceCkbTx(
    tokenInfo: RgbppTokenInfo,
    amount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    feeRate?: bigint,
  ): Promise<RgbppXudtIssuanceResult> {
    return this.ckbClient.xudtIssuanceTx(tokenInfo, amount, btcTxId, btcOutIdx, this.getBtcTestnetType(), feeRate);
  }

  async xudtTransferCkbTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    transferAmount: bigint,
    feeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcTransferVirtualTxResult> {
    return this.ckbClient.xudtTransferTx(
      xudtTypeArgs,
      btcOutpoints,
      transferAmount,
      this.getBtcTestnetType(),
      feeRate,
      noMergeOutputCells,
      witnessLockPlaceholderSize,
    );
  }

  async xudtTransferAll(params: TransferAllTxsParams): Promise<RgbppTransferAllTxsResult> {
    return buildRgbppTransferAllTxs({
      ckb: {
        ...params.ckb,
        collector: this.ckbClient.getCollector(),
      },
      btc: {
        ...params.btc,
        dataSource: this.btcClient.getDataSource(),
        testnetType: this.getBtcTestnetType(),
      },
      isMainnet: this.isOnMainnet(),
    });
  }

  async xudtBatchTransferCkbTx(
    xudtTypeArgs: string,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    rgbppReceivers: RgbppBtcAddressReceiver[],
  ): Promise<BtcBatchTransferVirtualTxResult> {
    return this.ckbClient.xudtBatchTransferTx(xudtTypeArgs, btcOutpoints, rgbppReceivers, this.getBtcTestnetType());
  }

  async xudtLeapFromCkbToBtcCkbTx(
    xudtTypeArgs: string,
    leapAmount: bigint,
    btcTxId: string,
    btcOutIdx: number,
    ckbFeeRate?: bigint,
    witnessLockPlaceholderSize?: number,
  ): Promise<CKBComponents.RawTransaction> {
    return this.ckbClient.xudtLeapFromCkbToBtcTx(
      xudtTypeArgs,
      leapAmount,
      btcTxId,
      btcOutIdx,
      this.getBtcTestnetType(),
      ckbFeeRate,
      witnessLockPlaceholderSize,
    );
  }

  async xudtLeapFromBtcToCkbCkbTx(
    xudtTypeArgs: string,
    toCkbAddress: string,
    leapAmount: bigint,
    btcOutpoints: { btcTxId: string; btcOutIdx: number }[],
    btcConfirmationBlocks?: number,
    ckbFeeRate?: bigint,
    noMergeOutputCells?: boolean,
    witnessLockPlaceholderSize?: number,
  ): Promise<BtcJumpCkbVirtualTxResult> {
    return this.ckbClient.xudtLeapFromBtcToCkbTx(
      xudtTypeArgs,
      toCkbAddress,
      btcOutpoints,
      leapAmount,
      this.getBtcTestnetType(),
      btcConfirmationBlocks,
      ckbFeeRate,
      noMergeOutputCells,
      witnessLockPlaceholderSize,
    );
  }

  async buildBtcPsbt(rgbppUtxoProps: RgbppUtxoProps): Promise<bitcoin.Psbt> {
    return this.btcClient.buildPsbt(rgbppUtxoProps, this.ckbClient.getCollector());
  }

  async signAndSendBtcPsbt(psbt: bitcoin.Psbt): Promise<{
    txHex: string;
    txId: BtcTxHash;
    rawTxHex: string;
  }> {
    return this.btcClient.signAndSendPsbt(psbt);
  }

  getBtcAddress(): string {
    return this.btcClient.getBtcAddress();
  }

  async sendRgbppCkbTransaction(
    btcTxId: string | BtcTxHash,
    ckbVirtualResult: string | RgbppApiSendCkbVirtualResult,
  ): Promise<RgbppApiTransactionState> {
    return this.btcClient.sendRgbppCkbTransaction(btcTxId, ckbVirtualResult);
  }

  async getRgbppSpvProof(btcTxId: string | BtcTxHash, confirmations = 0): Promise<RgbppApiSpvProof> {
    return this.btcClient.getRgbppSpvProof(btcTxId, confirmations);
  }

  async getRgbppTransactionState(
    btcTxId: string | BtcTxHash,
    rgbppApiTransactionStateParams?: RgbppApiTransactionStateParams,
  ): Promise<RgbppApiTransactionState> {
    return this.btcClient.getRgbppTransactionState(btcTxId, rgbppApiTransactionStateParams);
  }

  async getRgbppTransactionHash(btcTxId: string | BtcTxHash): Promise<CkbTxHash> {
    const { txhash: txHash } = await this.btcClient.getRgbppTransactionHash(btcTxId);
    return this.ckbClient.newCkbTxHash(txHash);
  }
}
