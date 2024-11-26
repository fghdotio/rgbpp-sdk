import { BTCTestnetType, Collector } from '@rgbpp-sdk/ckb';
import * as bitcoin from 'bitcoinjs-lib';

import { RgbppApiSpvProof } from '@rgbpp-sdk/service';

import { SendRgbppUtxosProps } from '../api/sendRgbppUtxos';
import { BtcTxHash } from './types';

export interface IBtcClient {
  getTestnetType(): BTCTestnetType | undefined;

  getBtcAddress(): string;

  buildPsbt(rgbppUtxoProps: RgbppUtxoProps, ckbCollector: Collector): Promise<bitcoin.Psbt>;

  signAndSendPsbt(psbt: bitcoin.Psbt): Promise<{
    txHex: string;
    txId: BtcTxHash;
    rawTxHex: string;
  }>;

  getRgbppSpvProof(btcTxId: string | BtcTxHash, confirmations: number): Promise<RgbppApiSpvProof>;
}

export interface RgbppUtxoProps extends Omit<SendRgbppUtxosProps, 'source' | 'ckbCollector' | 'from'> {}
