import { RgbppClient2, BtcAssetsApiError } from 'rgbpp';
import { ckbNetwork, updateCkbTxWithRealBtcTxId, BTC_JUMP_CONFIRMATION_BLOCKS } from 'rgbpp/ckb';

import { RGBPP_TOKEN_INFO } from './launch/0-rgbpp-token-info';

import { saveCkbVirtualTxResult } from '../shared/utils';
import {
  BTC_TESTNET_TYPE,
  CKB_PRIVATE_KEY,
  ckbAddress,
  BTC_SERVICE_URL,
  BTC_SERVICE_TOKEN,
  BTC_SERVICE_ORIGIN,
  BTC_PRIVATE_KEY,
  BTC_ADDRESS_TYPE,
} from '../env';

const leapXudtFromBtcToCKB = async (args: {
  btcTxId: string;
  btcOutIndexStr: string;
  receiverCkbAddress: string;
  rgbppXudtUniqueId: string;
  leapAmountStr: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIndex, receiverCkbAddress, rgbppXudtUniqueId, leapAmount, btcFeeRate } = parseArgs(args);

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

  const leapCkbVirtualTxResult = await rgbppClient.xudtLeapFromBtcToCkbCkbTx(
    rgbppXudtUniqueId,
    receiverCkbAddress,
    leapAmount,
    [{ btcTxId, btcOutIdx: btcOutIndex }],
  );
  saveCkbVirtualTxResult(leapCkbVirtualTxResult, '3-btc-leap-ckb-rfc');

  const { ckbRawTx, commitment } = leapCkbVirtualTxResult;

  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: [rgbppClient.getBtcAddress()],
    feeRate: btcFeeRate,
  });

  const { txId: susBtcTxId } = await rgbppClient.signAndSendBtcPsbt(psbt);
  console.log(`RGB++ xUDT is being leaped from BTC to CKB and the related BTC tx is ${susBtcTxId}`);

  await rgbppClient.sendRgbppCkbTransaction(susBtcTxId, leapCkbVirtualTxResult);

  let attempt = 0;
  const interval = setInterval(async () => {
    try {
      const { state, failedReason } = await rgbppClient.getRgbppTransactionState(susBtcTxId);
      console.log(`RGB++ transaction state: ${state} (attempt ${++attempt})`);
      if (state === 'completed' || state === 'failed') {
        clearInterval(interval);
        if (state === 'completed') {
          const ckbTxHash = await rgbppClient.getRgbppTransactionHash(susBtcTxId);
          console.info(`RGB++ asset has been leaped from BTC to CKB and the related CKB tx is ${ckbTxHash}`);

          const rgbppCkbTx = await updateCkbTxWithRealBtcTxId({
            ckbRawTx,
            btcTxId: susBtcTxId.raw(),
            isMainnet: rgbppClient.isOnMainnet(),
          });

          console.log(
            `Execute the following command to unlock the leaped xUDT after ${BTC_JUMP_CONFIRMATION_BLOCKS} BTC block confirmations:\n`,
          );
          console.log(
            `RGBPP_BTC_TIME_LOCK_SCRIPT_ARGS=${rgbppCkbTx.outputs[0].lock.args} npx tsx xudt/4-unlock-btc-time-cell-rfc.ts`,
          );
        } else {
          console.warn(`RGB++ CKB transaction failed: ${failedReason}`);
        }
      }
    } catch (error) {
      if (!(error instanceof BtcAssetsApiError)) {
        console.error(error);
      }
    }
  }, 30 * 1000);
};

const parseArgs = ({
  btcTxId,
  btcOutIndexStr,
  receiverCkbAddress,
  rgbppXudtUniqueId,
  leapAmountStr,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIndexStr: string;
  receiverCkbAddress: string;
  rgbppXudtUniqueId: string;
  leapAmountStr: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutIndex = parseInt(btcOutIndexStr);
  if (isNaN(btcOutIndex)) {
    throw new Error('RGBPP_XUDT_BTC_OUT_INDEX is not a number');
  }
  let leapAmount: bigint;
  try {
    leapAmount = BigInt(leapAmountStr) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
  } catch (error) {
    throw new Error('RGBPP_XUDT_LEAP_AMOUNT is not a number');
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIndex, receiverCkbAddress, rgbppXudtUniqueId, leapAmount, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  }
  return { btcTxId, btcOutIndex, receiverCkbAddress, rgbppXudtUniqueId, leapAmount };
};

leapXudtFromBtcToCKB({
  btcTxId: process.env.RGBPP_XUDT_BTC_TX_ID!,
  btcOutIndexStr: process.env.RGBPP_XUDT_BTC_OUT_INDEX!,
  receiverCkbAddress: process.env.RGBPP_XUDT_RECEIVER_CKB_ADDRESS!,
  rgbppXudtUniqueId: process.env.RGBPP_XUDT_UNIQUE_ID!,
  leapAmountStr: process.env.RGBPP_XUDT_LEAP_AMOUNT!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});

/* 
Usage:

RGBPP_XUDT_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_BTC_OUT_INDEX=<btc_out_index> 
RGBPP_XUDT_RECEIVER_CKB_ADDRESS=<receiver_ckb_address> RGBPP_XUDT_UNIQUE_ID=<rgbpp_xudt_unique_id> RGBPP_XUDT_LEAP_AMOUNT=<leap_amount> [RGBPP_BTC_FEE_RATE=<btc_fee_rate>] npx tsx xudt/3-btc-leap-ckb-rfc.ts 

Note:
- RGBPP_XUDT_LEAP_AMOUNT should be the raw amount without decimals (e.g., use 100_0000 for 1M tokens, the decimal places will be automatically applied based on RGBPP_TOKEN_INFO.decimal)
- RGBPP_BTC_FEE_RATE is optional, uses default network fee rate if not specified
*/
