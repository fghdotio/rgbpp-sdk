import { RgbppClient2, BtcAssetsApiError } from 'rgbpp';
import { ckbNetwork } from 'rgbpp/ckb';

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

const transferRgbppXudt = async (args: {
  btcTxId: string;
  btcOutIndexStr: string;
  receiverBtcAddress: string;
  rgbppXudtUniqueId: string;
  transferAmountStr: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIndex, rgbppXudtUniqueId, amount, receiverBtcAddress, btcFeeRate } = parseArgs(args);

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

  const transferVirtualTx = await rgbppClient.xudtTransferCkbTx(
    rgbppXudtUniqueId,
    [{ btcTxId, btcOutIdx: btcOutIndex }],
    amount,
  );
  saveCkbVirtualTxResult(transferVirtualTx, '2-btc-transfer-rfc');

  const { ckbRawTx, commitment, needPaymasterCell } = transferVirtualTx;
  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: [receiverBtcAddress],
    needPaymaster: needPaymasterCell,
    feeRate: btcFeeRate,
  });
  const { txId: susBtcTxId } = await rgbppClient.signAndSendBtcPsbt(psbt);

  console.log(`RGB++ xUDT transfer BTC tx: ${susBtcTxId}`);

  await rgbppClient.sendRgbppCkbTransaction(susBtcTxId, transferVirtualTx);

  let attempt = 0;
  const interval = setInterval(async () => {
    try {
      const { state, failedReason } = await rgbppClient.getRgbppTransactionState(susBtcTxId);
      console.log(`RGB++ transaction state: ${state} (attempt ${++attempt})`);
      if (state === 'completed' || state === 'failed') {
        clearInterval(interval);
        if (state === 'completed') {
          const ckbTxHash = await rgbppClient.getRgbppTransactionHash(susBtcTxId);
          console.info(`RGB++ xUDT has been transferred on BTC and the related CKB tx is ${ckbTxHash}`);
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
  receiverBtcAddress,
  rgbppXudtUniqueId,
  transferAmountStr,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIndexStr: string;
  receiverBtcAddress: string;
  rgbppXudtUniqueId: string;
  transferAmountStr: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutIndex = parseInt(btcOutIndexStr);
  if (isNaN(btcOutIndex)) {
    throw new Error('RGBPP_XUDT_BTC_OUT_INDEX is not a number');
  }
  let amount: bigint;
  try {
    amount = BigInt(transferAmountStr) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
  } catch (error) {
    throw new Error('RGBPP_XUDT_TRANSFER_AMOUNT is not a number');
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIndex, receiverBtcAddress, rgbppXudtUniqueId, amount, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcTxId, btcOutIndex, receiverBtcAddress, rgbppXudtUniqueId, amount };
  }
};

transferRgbppXudt({
  btcTxId: process.env.RGBPP_XUDT_BTC_TX_ID!,
  btcOutIndexStr: process.env.RGBPP_XUDT_BTC_OUT_INDEX!,
  receiverBtcAddress: process.env.RGBPP_XUDT_RECEIVER_BTC_ADDRESS!,
  rgbppXudtUniqueId: process.env.RGBPP_XUDT_UNIQUE_ID!,
  transferAmountStr: process.env.RGBPP_XUDT_TRANSFER_AMOUNT!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});

/* 
Usage:
RGBPP_XUDT_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_BTC_OUT_INDEX=<btc_out_index> RGBPP_XUDT_RECEIVER_BTC_ADDRESS=<receiver_btc_address> RGBPP_XUDT_UNIQUE_ID=<rgbpp_xudt_unique_id> RGBPP_XUDT_TRANSFER_AMOUNT=<transfer_amount> [RGBPP_BTC_FEE_RATE=<btc_fee_rate>] npx tsx xudt/2-btc-transfer-rfc.ts 

Note:
- RGBPP_XUDT_TRANSFER_AMOUNT should be the raw amount without decimals (e.g., use 100_0000 for 1M tokens, the decimal places will be automatically applied based on RGBPP_TOKEN_INFO.decimal)
- RGBPP_BTC_FEE_RATE is optional, if not provided, the default fee rate will be used
*/
