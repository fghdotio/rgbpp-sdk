import { Psbt } from 'bitcoinjs-lib';

import { BTCTestnetType, Collector } from '@rgbpp-sdk/ckb';

import {
  RgbppApiSpvProof,
  RgbppApiTransactionState,
  RgbppApiTransactionStateParams,
  RgbppApiCkbTransactionHash,
  RgbppApiSendCkbVirtualResult,
} from '@rgbpp-sdk/service';

import { BtcTxHash } from './types';

import { SendRgbppUtxosProps } from '../api/sendRgbppUtxos';
import { DataSource } from '../query/source';

export interface IBtcClient {
  isOnMainnet(): boolean;
  getTestnetType(): BTCTestnetType | undefined;
  getBtcAddress(): string;
  getDataSource(): DataSource;

  buildPsbt(rgbppUtxoProps: RgbppUtxoProps, ckbCollector: Collector): Promise<Psbt>;
  signAndSendPsbt(psbt: Psbt): Promise<{
    txHex: string;
    txId: BtcTxHash;
    rawTxHex: string;
  }>;

  getRgbppSpvProof(btcTxId: string | BtcTxHash, confirmations: number): Promise<RgbppApiSpvProof>;
  getRgbppTransactionState(
    btcTxId: string | BtcTxHash,
    rgbppApiTransactionStateParams?: RgbppApiTransactionStateParams,
  ): Promise<RgbppApiTransactionState>;
  getRgbppTransactionHash(btcTxId: string | BtcTxHash): Promise<RgbppApiCkbTransactionHash>;
  sendRgbppCkbTransaction(
    btcTxId: string | BtcTxHash,
    ckbVirtualResult: string | RgbppApiSendCkbVirtualResult,
  ): Promise<RgbppApiTransactionState>;
}

export interface RgbppUtxoProps extends Omit<SendRgbppUtxosProps, 'source' | 'ckbCollector' | 'from'> {}
