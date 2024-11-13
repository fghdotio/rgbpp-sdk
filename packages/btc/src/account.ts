import * as bitcoin from 'bitcoinjs-lib';

import { AddressType, addressToScriptPublicKeyHex } from './address';
import { NetworkType } from './preset/types';
import { networkTypeToNetwork } from './preset/network';
import { remove0x, toXOnly, tweakSigner } from './utils';
import { ECPair } from './bitcoin';

export interface BtcAccount {
  from: string;
  fromPubkey?: string;
  keyPair: bitcoin.Signer;
  payment: bitcoin.Payment;
  addressType: AddressType;
  networkType: NetworkType;
}

export function createBtcAccount(privKey: string, addType: string, btcNetwork: string): BtcAccount {
  const addressType = addType === 'P2TR' ? AddressType.P2TR : AddressType.P2WPKH;
  const networkType = btcNetwork === 'mainnet' ? NetworkType.MAINNET : NetworkType.TESTNET;

  const network = networkTypeToNetwork(networkType);

  const key = Buffer.from(remove0x(privKey), 'hex');
  const keyPair = ECPair.fromPrivateKey(key, { network });

  if (addressType === AddressType.P2WPKH) {
    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network,
    });
    return {
      from: p2wpkh.address!,
      payment: p2wpkh,
      keyPair,
      addressType,
      networkType,
    };
  } else if (addressType === AddressType.P2TR) {
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keyPair.publicKey),
      network,
    });
    return {
      from: p2tr.address!,
      fromPubkey: keyPair.publicKey.toString('hex'),
      payment: p2tr,
      keyPair,
      addressType,
      networkType,
    };
  } else {
    throw new Error('Unsupported address type, only support P2WPKH and P2TR');
  }
}

export function signPsbt(psbt: bitcoin.Psbt, account: BtcAccount): bitcoin.Psbt {
  const accountScript = addressToScriptPublicKeyHex(account.from, account.networkType);
  const tweakedSigner = tweakSigner(account.keyPair, {
    network: account.payment.network,
  });

  psbt.data.inputs.forEach((input, index) => {
    if (input.witnessUtxo) {
      const script = input.witnessUtxo.script.toString('hex');
      if (script === accountScript && account.addressType === AddressType.P2WPKH) {
        psbt.signInput(index, account.keyPair);
      }
      if (script === accountScript && account.addressType === AddressType.P2TR) {
        psbt.signInput(index, tweakedSigner);
      }
    }
  });

  return psbt;
}
