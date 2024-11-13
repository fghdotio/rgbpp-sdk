import dotenv from 'dotenv';
import {
  blake160,
  bytesToHex,
  privateKeyToPublicKey,
  scriptToAddress,
  systemScripts,
} from '@nervosnetwork/ckb-sdk-utils';
import { NetworkType, AddressType, DataSource } from 'rgbpp/btc';
import { BtcAssetsApi } from 'rgbpp/service';
import { BTCTestnetType, Collector } from 'rgbpp/ckb';
import { createBtcAccount } from './shared/btc-account';

dotenv.config({ path: __dirname + '/.env' });

/**
 * Network
 */

export const isMainnet = process.env.IS_MAINNET === 'true';

/**
 * CKB
 */

export const collector = new Collector({
  ckbNodeUrl: process.env.CKB_NODE_URL!,
  ckbIndexerUrl: process.env.CKB_INDEXER_URL!,
});
export const CKB_PRIVATE_KEY = process.env.CKB_SECP256K1_PRIVATE_KEY!;
const secp256k1Lock: CKBComponents.Script = {
  ...systemScripts.SECP256K1_BLAKE160,
  args: bytesToHex(blake160(privateKeyToPublicKey(CKB_PRIVATE_KEY))),
};
export const ckbAddress = scriptToAddress(secp256k1Lock, isMainnet);

/**
 * BTC
 */

export const BTC_PRIVATE_KEY = process.env.BTC_PRIVATE_KEY!;
export const BTC_TESTNET_TYPE = process.env.BTC_TESTNET_TYPE! as BTCTestnetType;
export const BTC_SERVICE_URL = process.env.VITE_BTC_SERVICE_URL!;
export const BTC_SERVICE_TOKEN = process.env.VITE_BTC_SERVICE_TOKEN!;
export const BTC_SERVICE_ORIGIN = process.env.VITE_BTC_SERVICE_ORIGIN!;
export const BTC_ADDRESS_TYPE = process.env.BTC_ADDRESS_TYPE!;

// Read more about the available address types:
// - P2WPKH: https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#p2wpkh
// - P2TR: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
const addressType = process.env.BTC_ADDRESS_TYPE === 'P2TR' ? AddressType.P2TR : AddressType.P2WPKH;
const networkType = isMainnet ? NetworkType.MAINNET : NetworkType.TESTNET;
export const btcAccount = createBtcAccount(BTC_PRIVATE_KEY, addressType, networkType);

export const btcService = BtcAssetsApi.fromToken(BTC_SERVICE_URL, BTC_SERVICE_TOKEN, BTC_SERVICE_ORIGIN);
export const btcDataSource = new DataSource(btcService, networkType);
