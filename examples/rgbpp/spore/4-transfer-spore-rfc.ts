import { RgbppClient2, BtcAssetsApiError } from 'rgbpp';
import { ckbNetwork } from 'rgbpp/ckb';

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
import { saveCkbVirtualTxResult } from '../shared/utils';

const transferSpore = async (args: {
  btcTxId: string;
  btcOutIdxStr: string;
  receiverBtcAddress: string;
  sporeTypeArgs: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIdx, receiverBtcAddress, sporeTypeArgs, btcFeeRate } = parseArgs(args);

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

  const ckbVirtualTxResult = await rgbppClient.sporeTransferCkbTx(btcTxId, btcOutIdx, sporeTypeArgs);
  saveCkbVirtualTxResult(ckbVirtualTxResult, '4-transfer-spore-rfc');

  const { commitment, ckbRawTx, needPaymasterCell } = ckbVirtualTxResult;

  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: [receiverBtcAddress],
    needPaymaster: needPaymasterCell,
    feeRate: btcFeeRate,
  });

  const { txId: susBtcTxId } = await rgbppClient.signAndSendBtcPsbt(psbt);

  console.log(`RGB++ spore transfer BTC tx: ${susBtcTxId}`);

  await rgbppClient.sendRgbppCkbTransaction(susBtcTxId, ckbVirtualTxResult);

  let attempt = 0;
  const interval = setInterval(async () => {
    try {
      const { state, failedReason } = await rgbppClient.getRgbppTransactionState(susBtcTxId);
      console.log(`RGB++ transaction state: ${state} (attempt ${++attempt})`);
      if (state === 'completed' || state === 'failed') {
        clearInterval(interval);
        if (state === 'completed') {
          const ckbTxHash = await rgbppClient.getRgbppTransactionHash(susBtcTxId);
          console.info(`RGB++ Spore has been transferred on BTC and the related CKB tx is ${ckbTxHash}`);
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
  btcOutIdxStr,
  receiverBtcAddress,
  sporeTypeArgs,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIdxStr: string;
  receiverBtcAddress: string;
  sporeTypeArgs: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutIdx = parseInt(btcOutIdxStr);
  if (isNaN(btcOutIdx)) {
    throw new Error('RGBPP_SPORE_BTC_OUT_INDEX is not a number');
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIdx, receiverBtcAddress, sporeTypeArgs, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcTxId, btcOutIdx, receiverBtcAddress, sporeTypeArgs };
  }
};

transferSpore({
  btcTxId: process.env.RGBPP_SPORE_BTC_TX_ID!,
  btcOutIdxStr: process.env.RGBPP_SPORE_BTC_OUT_INDEX!,
  receiverBtcAddress: process.env.RGBPP_SPORE_RECEIVER_BTC_ADDRESS!,
  sporeTypeArgs: process.env.RGBPP_SPORE_TYPE_ARGS!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});
