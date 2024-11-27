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
} from '@rgbpp-sdk/ckb';

import { IBtcClient, BtcClient2, bitcoin, RgbppUtxoProps, BtcTxHash } from '@rgbpp-sdk/btc';

import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

import { RgbppClientConfig } from './types';

export class RgbppClient2 {
  constructor(
    private readonly ckbClient: ICkbClient,
    private readonly btcClient: IBtcClient,
  ) {}

  static create(config: RgbppClientConfig): RgbppClient2 {
    const ckbClient = CkbClient2.create(config.ckbNetwork, config.ckbPrivateKey, config.ckbJsonRpcUrl);
    const btcClient = BtcClient2.create(config.btcNetwork, config.btcAssetsApiConfig, config.btcAccountConfig);

    return new RgbppClient2(ckbClient, btcClient);
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
    return this.ckbClient.assembleLeapFromCkbToBtcTx(ckbRawTx);
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
    witnessLockPlaceholderSize?: number,
    ckbFeeRate?: bigint,
  ): Promise<CKBComponents.RawTransaction> {
    return this.ckbClient.xudtLeapFromCkbToBtcTx(
      xudtTypeArgs,
      leapAmount,
      btcTxId,
      btcOutIdx,
      this.getBtcTestnetType(),
      witnessLockPlaceholderSize,
      ckbFeeRate,
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

  getBtcAddress() {
    return this.btcClient.getBtcAddress();
  }

  getRgbppSpvProof(btcTxId: string | BtcTxHash, confirmations = 0): Promise<RgbppApiSpvProof> {
    return this.btcClient.getRgbppSpvProof(btcTxId, confirmations);
  }
}
