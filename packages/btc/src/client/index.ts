import { BtcAssetsApi } from '@rgbpp-sdk/service';
import * as bitcoin from 'bitcoinjs-lib';

import { BtcAccount, createBtcAccount, signPsbt } from '../account';
import { transactionToHex } from '../utils';

export type BtcNetwork = 'Mainnet' | 'Testnet3' | 'Signet';

export class BtcClient {
  private network: BtcNetwork;
  private btcAccount: BtcAccount;
  private assetsApi: BtcAssetsApi;

  constructor(network: BtcNetwork, btcAssetsApiConfig: BtcAssetsApiConfig, btcAccountConfig: BtcAccountConfig) {
    this.network = network;
    this.assetsApi = BtcAssetsApi.fromToken(
      btcAssetsApiConfig.url,
      btcAssetsApiConfig.token,
      btcAssetsApiConfig.origin,
    );
    this.btcAccount = createBtcAccount(
      btcAccountConfig.privateKey,
      btcAccountConfig.addressType,
      btcAccountConfig.networkType,
    );
  }

  getNetwork() {
    return this.network;
  }

  getAssetsApi() {
    return this.assetsApi;
  }

  async generatePbst() {}

  async getRgbppSpvProof(btcTxId: string, confirmations: number) {
    return await this.assetsApi.getRgbppSpvProof(btcTxId, confirmations);
  }

  async sendTransaction(psbt: bitcoin.Psbt) {
    signPsbt(psbt, this.btcAccount);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction(true);
    const txHex = tx.toHex();
    const { txid } = await this.assetsApi.sendBtcTransaction(txHex);

    return {
      txHex,
      txId: txid,
      // Exclude witness from the BTC_TX for unlocking RGBPP assets
      rawTxHex: transactionToHex(tx, false),
    };
  }

  isOnMainnet() {
    return this.network === 'Mainnet';
  }
}

export type BtcAssetsApiConfig = {
  url: string;
  token: string;
  origin?: string;
};

export type BtcAccountConfig = {
  privateKey: string;
  addressType: string;
  networkType: string;
};

export * from './btc';
export * from './interfaces';
export * from './types';
