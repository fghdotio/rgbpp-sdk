import { RgbppClient2 } from 'rgbpp';
import { ckbNetwork } from 'rgbpp/ckb';

import { saveCkbVirtualTxResult } from '../shared/utils';
import { RGBPP_TOKEN_INFO } from './launch/0-rgbpp-token-info';
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
  btcOutpoints: string;
  receiverBtcAddress: string;
  rgbppXudtUniqueId: string;
  transferAmountStr: string;
  btcFeeRateStr?: string;
}) => {
  const { btcOutpointList, rgbppXudtUniqueId, amount, receiverBtcAddress, btcFeeRate } = parseArgs(args);

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

  const transferVirtualTx = await rgbppClient.xudtTransferCkbTx(rgbppXudtUniqueId, btcOutpointList, amount);
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

  let attempt = 0;
  const interval = setInterval(async () => {
    try {
      console.log(`Waiting for BTC tx and proof to be ready: attempt ${++attempt}`);
      const { state, failedReason } = await rgbppClient.getRgbppTransactionState(susBtcTxId);
      if (state === 'completed' || state === 'failed') {
        clearInterval(interval);
        if (state === 'completed') {
          const ckbTxHash = await rgbppClient.getRgbppTransactionHash(susBtcTxId);
          console.info(`RGB++ asset has been transferred on BTC and the related CKB tx is ${ckbTxHash}`);
        } else {
          console.warn(`RGB++ CKB transaction failed: ${failedReason} `);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, 30 * 1000);
};

const parseArgs = ({
  btcOutpoints,
  receiverBtcAddress,
  rgbppXudtUniqueId,
  transferAmountStr,
  btcFeeRateStr,
}: {
  btcOutpoints: string;
  receiverBtcAddress: string;
  rgbppXudtUniqueId: string;
  transferAmountStr: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutpointList = btcOutpoints.split(';').map((outpoint) => {
    const [btcTxId, btcOutIndexStr] = outpoint.split(':');
    if (!btcTxId || !btcOutIndexStr) {
      throw new Error('Invalid btc outpoint format');
    }
    try {
      const btcOutIndex = parseInt(btcOutIndexStr);
      return { btcTxId, btcOutIdx: btcOutIndex };
    } catch (error) {
      throw new Error('index in BTC outpoint is not a number');
    }
  });
  let amount: bigint;
  try {
    amount = BigInt(transferAmountStr) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
  } catch (error) {
    throw new Error('RGBPP_XUDT_TRANSFER_AMOUNT is not a number');
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcOutpointList, receiverBtcAddress, rgbppXudtUniqueId, amount, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcOutpointList, receiverBtcAddress, rgbppXudtUniqueId, amount };
  }
};

transferRgbppXudt({
  btcOutpoints: process.env.RGBPP_XUDT_BTC_OUT_POINTS!,
  receiverBtcAddress: process.env.RGBPP_XUDT_RECEIVER_BTC_ADDRESS!,
  rgbppXudtUniqueId: process.env.RGBPP_XUDT_UNIQUE_ID!,
  transferAmountStr: process.env.RGBPP_XUDT_TRANSFER_AMOUNT!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});

/* 
Usage:
RGBPP_XUDT_BTC_OUT_POINTS=<btc_tx_id_1:btc_out_index_1;btc_tx_id_2:btc_out_index_2;...> RGBPP_XUDT_RECEIVER_BTC_ADDRESS=<receiver_btc_address> RGBPP_XUDT_UNIQUE_ID=<rgbpp_xudt_unique_id> RGBPP_XUDT_TRANSFER_AMOUNT=<transfer_amount> [RGBPP_BTC_FEE_RATE=<btc_fee_rate>] npx tsx xudt/2-btc-transfer-rfc.ts 

Note:
- RGBPP_XUDT_TRANSFER_AMOUNT should be the raw amount without decimals (e.g., use 100_0000 for 1M tokens, the decimal places will be automatically applied based on RGBPP_TOKEN_INFO.decimal)
- RGBPP_BTC_FEE_RATE is optional, if not provided, the default fee rate will be used
*/
