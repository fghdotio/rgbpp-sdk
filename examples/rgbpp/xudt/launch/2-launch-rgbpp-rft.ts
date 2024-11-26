/* eslint-disable */
import { RgbppClient2 } from 'rgbpp';

import { BtcAssetsApiError } from 'rgbpp';

import { ckbNetwork } from 'rgbpp/ckb';

import { saveCkbVirtualTxResult } from '../../shared/utils';

import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import {
  BTC_TESTNET_TYPE,
  CKB_PRIVATE_KEY,
  ckbAddress,
  BTC_SERVICE_URL,
  BTC_SERVICE_TOKEN,
  BTC_SERVICE_ORIGIN,
  BTC_PRIVATE_KEY,
  BTC_ADDRESS_TYPE,
} from '../../env';

const issueRgbppAsset = async (args: {
  btcTxId: string;
  btcOutIndexStr: string;
  issuanceAmountStr?: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIndex, issuanceAmount, btcFeeRate } = parseArgs(args);

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
    issuanceAmount,
    btcTxId,
    btcOutIndex,
  );
  console.log('RGBPP xUDT unique ID: ', rgbppXudtUniqueId);
  saveCkbVirtualTxResult(rgbppLaunchVirtualTxResult, '2-launch-rgbpp-rft');
  const { ckbRawTx, commitment, needPaymasterCell } = rgbppLaunchVirtualTxResult;

  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: [rgbppClient.getBtcAddress()],
    needPaymaster: needPaymasterCell,
    feeRate: btcFeeRate,
  });
  const { txId: susBtcTxId, rawTxHex: btcTxBytes } = await rgbppClient.signAndSendBtcPsbt(psbt);

  console.log('RGB++ xUDT issuance BTC tx id: ', susBtcTxId);

  let attempt = 0;
  let spvProofResponse: string;
  const interval = setInterval(async () => {
    try {
      console.log(`Waiting for BTC tx and proof to be ready (attempt ${++attempt}): ${spvProofResponse}`);
      const rgbppApiSpvProof = await rgbppClient.getRgbppSpvProof(susBtcTxId);
      clearInterval(interval);

      const ckbFinalTx = await rgbppClient.assembleXudtFinalCkbTx(ckbRawTx, susBtcTxId, btcTxBytes, rgbppApiSpvProof);
      const txHash = await rgbppClient.sendCkbTransaction(ckbFinalTx);
      console.info(`RGB++ Asset has been issued and CKB tx hash is ${txHash}`);
    } catch (error) {
      if (!(error instanceof BtcAssetsApiError)) {
        console.error(error);
      } else {
        spvProofResponse = error.message;
      }
    }
  }, 30 * 1000);
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
  let issuanceAmount: bigint;
  if (issuanceAmountStr) {
    try {
      issuanceAmount = BigInt(issuanceAmountStr) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
    } catch (error) {
      throw new Error('RGBPP_XUDT_ISSUANCE_AMOUNT is not a number');
    }
  } else {
    issuanceAmount = BigInt(2100_0000) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIndex, issuanceAmount, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcTxId, btcOutIndex, issuanceAmount };
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
RGBPP_XUDT_ISSUANCE_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_ISSUANCE_BTC_OUT_INDEX=<btc_out_index> [RGBPP_XUDT_ISSUANCE_AMOUNT=<launch_amount>] [RGBPP_BTC_FEE_RATE=<fee_rate>] npx tsx xudt/launch/2-launch-rgbpp-rft.ts

Example:
RGBPP_XUDT_ISSUANCE_BTC_TX_ID=abc123... RGBPP_XUDT_ISSUANCE_BTC_OUT_INDEX=0 npx tsx xudt/launch/2-launch-rgbpp-rft.ts

Note:
- RGBPP_XUDT_ISSUANCE_AMOUNT is optional, defaults to 2100_0000. The value should be the raw amount without decimals 
  (e.g., use 2100_0000 for 21M tokens, the decimal places will be automatically applied based on RGBPP_TOKEN_INFO.decimal)
- RGBPP_BTC_FEE_RATE is optional, uses default network fee rate if not specified
*/
