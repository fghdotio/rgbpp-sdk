import { AddressType } from '../address';
import { NetworkType } from '../preset/types';
import { networkTypeToNetwork } from '../preset/network';
import { isP2wpkhScript } from '../script';
import { ECPairInterface, bitcoin, ECPair } from '../bitcoin';
import { Utxo } from './utxo';

interface FeeEstimateAccount {
  payment: bitcoin.Payment;
  addressType: AddressType;
  address: string;
  scriptPubkey: string;
  tapInternalKey?: Buffer;
}

export class FeeEstimator {
  public networkType: NetworkType;
  public network: bitcoin.Network;

  private readonly keyPair: ECPairInterface;
  public readonly pubkey: string;
  public accounts: {
    p2pkh: FeeEstimateAccount;
  };

  constructor(wif: string, networkType: NetworkType) {
    const network = networkTypeToNetwork(networkType);
    this.networkType = networkType;
    this.network = network;

    const keyPair = ECPair.fromWIF(wif, network);
    this.pubkey = keyPair.publicKey.toString('hex');
    this.keyPair = keyPair;

    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network,
    });

    this.accounts = {
      p2pkh: {
        payment: p2wpkh,
        address: p2wpkh.address!,
        addressType: AddressType.P2PKH,
        scriptPubkey: p2wpkh.output!.toString('hex'),
      },
    };
  }

  static fromRandom(networkType: NetworkType) {
    const network = networkTypeToNetwork(networkType);
    const keyPair = ECPair.makeRandom({ network });
    return new FeeEstimator(keyPair.toWIF(), networkType);
  }

  replaceUtxo(utxo: Utxo): Utxo {
    if (utxo.addressType === AddressType.P2PKH || isP2wpkhScript(utxo.scriptPk)) {
      utxo.scriptPk = this.accounts.p2pkh.scriptPubkey;
      utxo.pubkey = this.pubkey;
    }

    return utxo;
  }

  async signPsbt(psbt: bitcoin.Psbt): Promise<bitcoin.Psbt> {
    psbt.data.inputs.forEach((_, index) => {
      psbt.signInput(index, this.keyPair);
    });

    psbt.finalizeAllInputs();
    return psbt;
  }
}
