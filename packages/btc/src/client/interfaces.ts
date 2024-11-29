import * as bitcoin from 'bitcoinjs-lib';

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

export interface IBtcClient {
  isOnMainnet(): boolean;
  getTestnetType(): BTCTestnetType | undefined;

  getBtcAddress(): string;

  buildPsbt(rgbppUtxoProps: RgbppUtxoProps, ckbCollector: Collector): Promise<bitcoin.Psbt>;

  signAndSendPsbt(psbt: bitcoin.Psbt): Promise<{
    txHex: string;
    txId: BtcTxHash;
    rawTxHex: string;
  }>;

  sendRgbppCkbTransaction(
    btcTxId: string | BtcTxHash,
    ckbVirtualResult: string | RgbppApiSendCkbVirtualResult,
  ): Promise<RgbppApiTransactionState>;

  getRgbppSpvProof(btcTxId: string | BtcTxHash, confirmations: number): Promise<RgbppApiSpvProof>;

  getRgbppTransactionState(
    btcTxId: string | BtcTxHash,
    rgbppApiTransactionStateParams?: RgbppApiTransactionStateParams,
  ): Promise<RgbppApiTransactionState>;

  getRgbppTransactionHash(btcTxId: string | BtcTxHash): Promise<RgbppApiCkbTransactionHash>;
}

export interface RgbppUtxoProps extends Omit<SendRgbppUtxosProps, 'source' | 'ckbCollector' | 'from'> {}
