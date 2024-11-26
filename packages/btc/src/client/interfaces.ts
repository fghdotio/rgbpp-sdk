import { BTCTestnetType, Collector } from '@rgbpp-sdk/ckb';
import * as bitcoin from 'bitcoinjs-lib';

import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

import { SendRgbppUtxosProps } from '../api/sendRgbppUtxos';

export interface IBtcClient {
  getTestnetType(): BTCTestnetType | undefined;

  getBtcAddress(): string;

  buildPsbt(rgbppUtxoProps: RgbppUtxoProps, ckbCollector: Collector): Promise<bitcoin.Psbt>;

  signAndSendPsbt(psbt: bitcoin.Psbt): Promise<{
    txHex: string;
    txId: string;
    rawTxHex: string;
  }>;

  getRgbppSpvProof(btcTxId: string, confirmations: number): Promise<RgbppApiSpvProof>;
}

export interface RgbppUtxoProps extends Omit<SendRgbppUtxosProps, 'source' | 'ckbCollector' | 'from'> {}
