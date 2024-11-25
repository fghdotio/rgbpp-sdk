/* eslint-disable */
import { RgbppClient2 } from 'rgbpp';

import { BtcAssetsApiError } from 'rgbpp';

import {
  appendCkbTxWitnessesCCC,
  updateCkbTxWithRealBtcTxIdCCC,
  ckbNetwork,
  MAGIC_NUMBER_RGBPP_ISSUANCE_BTC_OUT_INDEX,
} from 'rgbpp/ckb';

import { saveCkbVirtualTxResult } from '../../shared/utils';

import { buildRgbppUtxos } from 'rgbpp/btc';
import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import {
  BTC_TESTNET_TYPE,
  btcAccount,
  btcDataSource,
  btcService,
  isMainnet,
  CKB_PRIVATE_KEY,
  ckbAddress,
  BTC_SERVICE_URL,
  BTC_SERVICE_TOKEN,
  BTC_SERVICE_ORIGIN,
  BTC_PRIVATE_KEY,
  BTC_ADDRESS_TYPE,
} from '../../env';
import { signAndSendPsbt } from '../../shared/btc-account';
import { parse } from 'dotenv';

const issueRgbppAsset = async (args: {
  btcTxId: string;
  btcOutIndexStr: string;
  issuanceAmountStr?: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIndex, launchAmount, btcFeeRate } = parseArgs(args);

  const rgbppClient = RgbppClient2.create({
    ckbNetwork: ckbNetwork(ckbAddress),
    ckbPrivateKey: CKB_PRIVATE_KEY,
    btcNetwork: BTC_TESTNET_TYPE,
    btcAssetsApiConfig: {
      url: BTC_SERVICE_URL,
      token: BTC_SERVICE_TOKEN,
      origin: BTC_SERVICE_ORIGIN,
    },
    btcAccountConfig: {
      privateKey: BTC_PRIVATE_KEY,
      addressType: BTC_ADDRESS_TYPE,
      networkType: BTC_TESTNET_TYPE,
    },
  });

  const { rgbppLaunchVirtualTxResult, rgbppXudtUniqueId } = await rgbppClient.xudtIssuanceCkbTx(
    RGBPP_TOKEN_INFO,
    launchAmount,
    btcTxId,
    btcOutIndex,
    btcFeeRate,
  );
  console.log('RGBPP XUDT Unique ID: ', rgbppXudtUniqueId);
  console.log('RGBPP Launch Virtual Tx Result: ', rgbppLaunchVirtualTxResult);

  saveCkbVirtualTxResult(rgbppLaunchVirtualTxResult, '2-launch-rgbpp');
};

const parseArgs = ({
  btcTxId,
  btcOutIndexStr,
  issuanceAmountStr,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIndexStr: string;
  issuanceAmountStr?: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutIndex = parseInt(btcOutIndexStr);
  if (isNaN(btcOutIndex)) {
    throw new Error('RGBPP_XUDT_ISSUANCE_BTC_OUT_INDEX is not a number');
  }
  let launchAmount: bigint;
  if (issuanceAmountStr) {
    try {
      launchAmount = BigInt(issuanceAmountStr) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
    } catch (error) {
      throw new Error('RGBPP_XUDT_ISSUANCE_AMOUNT is not a number');
    }
  } else {
    launchAmount = BigInt(2100_0000) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = BigInt(parseInt(btcFeeRateStr));
      return { btcTxId, btcOutIndex, launchAmount, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcTxId, btcOutIndex, launchAmount };
  }
};

issueRgbppAsset({
  btcTxId: process.env.RGBPP_XUDT_ISSUANCE_BTC_TX_ID!,
  btcOutIndexStr: process.env.RGBPP_XUDT_ISSUANCE_BTC_OUT_INDEX!,
  issuanceAmountStr: process.env.RGBPP_XUDT_ISSUANCE_AMOUNT,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});

/* 
Usage:
RGBPP_XUDT_ISSUANCE_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_ISSUANCE_BTC_OUT_INDEX=<btc_out_index> [RGBPP_XUDT_ISSUANCE_AMOUNT=<launch_amount>] [RGBPP_BTC_FEE_RATE=<fee_rate>] npx tsx xudt/launch/2-launch-rgbpp-ccc.ts

Example:
RGBPP_XUDT_ISSUANCE_BTC_TX_ID=abc123... RGBPP_XUDT_ISSUANCE_BTC_OUT_INDEX=0 npx tsx xudt/launch/2-launch-rgbpp-ccc.ts

Note:
- RGBPP_XUDT_ISSUANCE_AMOUNT is optional, defaults to 2100_0000. The value should be the raw amount without decimals 
  (e.g., use 2100_0000 for 21M tokens, the decimal places will be automatically applied based on RGBPP_TOKEN_INFO.decimal)
- RGBPP_BTC_FEE_RATE is optional, uses default network fee rate if not specified
*/
