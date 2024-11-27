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

  console.log(`RGB++ xUDT transfer BTC tx id: ${susBtcTxId}`);

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
    throw new Error('RGBPP_XUDT_TRANSFER_BTC_OUT_INDEX is not a number');
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
  btcTxId: process.env.RGBPP_XUDT_TRANSFER_BTC_TX_ID!,
  btcOutIndexStr: process.env.RGBPP_XUDT_TRANSFER_BTC_OUT_INDEX!,
  receiverBtcAddress: process.env.RGBPP_XUDT_TRANSFER_RECEIVER_BTC_ADDRESS!,
  rgbppXudtUniqueId: process.env.RGBPP_XUDT_UNIQUE_ID!,
  transferAmountStr: process.env.RGBPP_XUDT_TRANSFER_AMOUNT!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});
