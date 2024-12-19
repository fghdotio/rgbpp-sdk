import { bitcoin } from './bitcoin';
import { NetworkType } from './preset/types';
import { networkTypeToNetwork } from './preset/network';
import { ErrorCodes, TxBuildError } from './error';
import { remove0x } from './utils';

export enum AddressType {
  P2PKH,
  P2SH,
  UNKNOWN,
}

const DOGE_DUST_LIMIT = 2000000;

/**
 * Type: Record<Address, Pubkey>
 *
 * The map of address and pubkey, usually for recognizing the P2TR inputs in the transaction.
 */
export type AddressToPubkeyMap = Record<string, string>;

/**
 * Check weather the address is supported as a from address.
 * Currently, only P2WPKH and P2TR addresses are supported.
 */
export function isSupportedFromAddress(address: string) {
  const { addressType } = decodeAddress(address);
  return addressType === AddressType.P2PKH;
}

/**
 * Convert public key to bitcoin payment object.
 */
export function publicKeyToPayment(publicKey: string, addressType: AddressType, networkType: NetworkType) {
  if (!publicKey) {
    return undefined;
  }

  const network = networkTypeToNetwork(networkType);
  const pubkey = Buffer.from(remove0x(publicKey), 'hex');

  if (addressType === AddressType.P2PKH) {
    return bitcoin.payments.p2pkh({
      pubkey,
      network,
    });
  }

  return undefined;
}

/**
 * Convert public key to bitcoin address.
 */
export function publicKeyToAddress(publicKey: string, addressType: AddressType, networkType: NetworkType) {
  const payment = publicKeyToPayment(publicKey, addressType, networkType);
  if (payment && payment.address) {
    return payment.address;
  } else {
    throw new TxBuildError(ErrorCodes.UNSUPPORTED_ADDRESS_TYPE);
  }
}

/**
 * Convert bitcoin address to scriptPk.
 */
export function addressToScriptPublicKey(address: string, networkType: NetworkType): Buffer {
  const network = networkTypeToNetwork(networkType);
  return bitcoin.address.toOutputScript(address, network);
}

/**
 * Convert bitcoin address to scriptPk in hex.
 */
export function addressToScriptPublicKeyHex(address: string, networkType: NetworkType): string {
  const scriptPk = addressToScriptPublicKey(address, networkType);
  return scriptPk.toString('hex');
}

/**
 * Check if the address is valid.
 */
export function isValidAddress(address: string, networkType: NetworkType) {
  try {
    bitcoin.address.toOutputScript(address, networkTypeToNetwork(networkType));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get AddressType of an address.
 */
export function getAddressType(address: string): AddressType {
  return decodeAddress(address).addressType;
}

export function decodeAddress(address: string): {
  networkType: NetworkType;
  addressType: AddressType;
  dust: number;
} {
  if (address.startsWith('D')) {
    return {
      networkType: NetworkType.MAINNET,
      addressType: AddressType.P2PKH,
      dust: DOGE_DUST_LIMIT,
    };
  } else if (address.startsWith('n')) {
    return {
      networkType: NetworkType.TESTNET,
      addressType: AddressType.P2PKH,
      dust: DOGE_DUST_LIMIT,
    };
  }
  throw new TxBuildError(ErrorCodes.UNSUPPORTED_ADDRESS_TYPE);
}

/**
 * Add address/pubkey pair to a Record<address, pubkey> map
 */
export function addAddressToPubkeyMap(
  pubkeyMap: AddressToPubkeyMap,
  address: string,
  pubkey?: string,
): Record<string, string> {
  const newMap = { ...pubkeyMap };
  if (pubkey) {
    newMap[address] = pubkey;
  }
  return newMap;
}
