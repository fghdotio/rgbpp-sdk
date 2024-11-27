import * as bitcoin from 'bitcoinjs-lib';

import {
  RgbppApiSpvProof,
  RgbppApiTransactionState,
  BtcAssetsApi,
  RgbppApiTransactionStateParams,
  RgbppApiCkbTransactionHash,
  RgbppApiSendCkbVirtualResult,
} from '@rgbpp-sdk/service';
import { Collector, BTCTestnetType } from '@rgbpp-sdk/ckb';

import { IBtcClient, RgbppUtxoProps } from './interfaces';
import { BtcNetwork, BtcAssetsApiConfig, BtcAccountConfig, BtcTxHash } from './types';

import { BtcAccount, createBtcAccount, signPsbt } from '../account';
import { sendRgbppUtxos } from '../api/sendRgbppUtxos';
import { DataSource } from '../query/source';
import { NetworkType } from '../preset/types';
import { transactionToHex } from '../utils';

export class BtcClient2 implements IBtcClient {
  constructor(
    private network: BtcNetwork,
    private btcAccount: BtcAccount,
    private dataSource: DataSource,
    private explorerBaseUrl: string,
  ) {}

  static create(
    network: BtcNetwork,
    btcAssetsApiConfig: BtcAssetsApiConfig,
    btcAccountConfig: BtcAccountConfig,
  ): BtcClient2 {
    const btcAccount = createBtcAccount(
      btcAccountConfig.privateKey,
      btcAccountConfig.addressType,
      btcAccountConfig.networkType,
    );
    const assetsApi = BtcAssetsApi.fromToken(
      btcAssetsApiConfig.url,
      btcAssetsApiConfig.token,
      btcAssetsApiConfig.origin,
    );
    const networkType = btcAccountConfig.networkType === 'Mainnet' ? NetworkType.MAINNET : NetworkType.TESTNET;
    const btcDataSource = new DataSource(assetsApi, networkType);
    const explorerBaseUrls: Record<BtcNetwork, string> = {
      Mainnet: 'https://mempool.space',
      Testnet3: 'https://mempool.space/testnet',
      Signet: 'https://mempool.space/signet',
    };

    return new BtcClient2(network, btcAccount, btcDataSource, explorerBaseUrls[network]);
  }

  getTestnetType(): BTCTestnetType | undefined {
    const networkMap: Record<BtcNetwork, BTCTestnetType | undefined> = {
      Testnet3: 'Testnet3',
      Signet: 'Signet',
      Mainnet: undefined,
    };
    return networkMap[this.network];
  }

  getBtcAddress() {
    return this.btcAccount.from;
  }

  async buildPsbt(rgbppUtxoProps: RgbppUtxoProps, ckbCollector: Collector): Promise<bitcoin.Psbt> {
    return sendRgbppUtxos({
      ...rgbppUtxoProps,
      ckbCollector,
      source: this.dataSource,
      from: this.btcAccount.from,
    });
  }

  async signAndSendPsbt(psbt: bitcoin.Psbt): Promise<{
    txHex: string;
    txId: BtcTxHash;
    rawTxHex: string;
  }> {
    signPsbt(psbt, this.btcAccount);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction(true);
    const txHex = tx.toHex();

    const { txid } = await this.dataSource.service.sendBtcTransaction(txHex);

    return {
      txHex,
      txId: new BtcTxHash(txid, this.explorerBaseUrl),
      // Exclude witness from the BTC_TX for unlocking RGBPP assets
      rawTxHex: transactionToHex(tx, false),
    };
  }

  async sendRgbppCkbTransaction(
    btcTxId: string | BtcTxHash,
    ckbVirtualResult: string | RgbppApiSendCkbVirtualResult,
  ): Promise<RgbppApiTransactionState> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.dataSource.service.sendRgbppCkbTransaction({ btc_txid: btcTxId, ckb_virtual_result: ckbVirtualResult });
  }

  async getRgbppSpvProof(btcTxId: string | BtcTxHash, confirmations = 0): Promise<RgbppApiSpvProof> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.dataSource.service.getRgbppSpvProof(btcTxId, confirmations);
  }

  async getRgbppTransactionState(
    btcTxId: string | BtcTxHash,
    rgbppApiTransactionStateParams?: RgbppApiTransactionStateParams,
  ): Promise<RgbppApiTransactionState> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.dataSource.service.getRgbppTransactionState(btcTxId, rgbppApiTransactionStateParams);
  }

  async getRgbppTransactionHash(btcTxId: string | BtcTxHash): Promise<RgbppApiCkbTransactionHash> {
    if (btcTxId instanceof BtcTxHash) {
      btcTxId = btcTxId.raw();
    }
    return this.dataSource.service.getRgbppTransactionHash(btcTxId);
  }
}
