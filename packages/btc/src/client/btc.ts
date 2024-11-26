import { IBtcClient, RgbppUtxoProps } from './interfaces';
import { BtcAssetsApi } from '@rgbpp-sdk/service';

import { BtcNetwork, BtcAssetsApiConfig, BtcAccountConfig } from './types';
import { BtcAccount, createBtcAccount, signPsbt } from '../account';
import { sendRgbppUtxos } from '../api/sendRgbppUtxos';
import { DataSource } from '../query/source';
import { NetworkType } from '../preset/types';
import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

import { Collector } from '@rgbpp-sdk/ckb';

import { transactionToHex } from '../utils';

import * as bitcoin from 'bitcoinjs-lib';

import { BTCTestnetType } from '@rgbpp-sdk/ckb';

export class BtcClient2 implements IBtcClient {
  constructor(
    private network: BtcNetwork,
    private btcAccount: BtcAccount,
    private dataSource: DataSource,
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

    return new BtcClient2(network, btcAccount, btcDataSource);
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
    return await sendRgbppUtxos({
      ...rgbppUtxoProps,
      ckbCollector,
      source: this.dataSource,
      from: this.btcAccount.from,
    });
  }

  async signAndSendPsbt(psbt: bitcoin.Psbt): Promise<{
    txHex: string;
    txId: string;
    rawTxHex: string;
  }> {
    signPsbt(psbt, this.btcAccount);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction(true);
    const txHex = tx.toHex();

    const { txid } = await this.dataSource.service.sendBtcTransaction(txHex);

    return {
      txHex,
      txId: txid,
      // Exclude witness from the BTC_TX for unlocking RGBPP assets
      rawTxHex: transactionToHex(tx, false),
    };
  }

  getRgbppSpvProof(btcTxId: string, confirmations = 0): Promise<RgbppApiSpvProof> {
    return this.dataSource.service.getRgbppSpvProof(btcTxId, confirmations);
  }
}
