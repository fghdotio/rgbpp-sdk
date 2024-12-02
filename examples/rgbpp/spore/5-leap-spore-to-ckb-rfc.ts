import { RgbppClient2, BtcAssetsApiError } from 'rgbpp';
import { ckbNetwork } from 'rgbpp/ckb';

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

const leapSporeFromBtcToCkb = async (args: {
  btcTxId: string;
  btcOutIndexStr: string;
  receiverCkbAddress: string;
  sporeTypeArgs: string;
  btcFeeRateStr: string;
}) => {
  const { btcTxId, btcOutIdx, receiverCkbAddress, sporeTypeArgs, btcFeeRate } = parseArgs(args);

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

  const ckbVirtualTxResult = await rgbppClient.sporeLeapFromBtcToCkbCkbTx(
    btcTxId,
    btcOutIdx,
    sporeTypeArgs,
    receiverCkbAddress,
  );

  saveCkbVirtualTxResult(ckbVirtualTxResult, '5-leap-spore-to-ckb-rfc');

  const { commitment, ckbRawTx, needPaymasterCell } = ckbVirtualTxResult;

  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: [rgbppClient.getBtcAddress()],
    needPaymaster: needPaymasterCell,
    feeRate: btcFeeRate,
  });

  const { txId: susBtcTxId } = await rgbppClient.signAndSendBtcPsbt(psbt);
  console.log(`RGB++ Spore is being leaped from BTC to CKB and the related BTC tx is ${susBtcTxId}`);

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
          console.info(`RGB++ Spore has been leaped from BTC to CKB and the related CKB tx is ${ckbTxHash}`);
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
  sporeTypeArgs,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIndexStr: string;
  receiverCkbAddress: string;
  sporeTypeArgs: string;
  btcFeeRateStr: string;
}) => {
  const btcOutIdx = parseInt(btcOutIndexStr);
  if (isNaN(btcOutIdx)) {
    throw new Error('RGBPP_SPORE_BTC_OUT_INDEX is not a number');
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIdx, receiverCkbAddress, sporeTypeArgs, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  }
  return { btcTxId, btcOutIdx, receiverCkbAddress, sporeTypeArgs };
};

leapSporeFromBtcToCkb({
  btcTxId: process.env.RGBPP_SPORE_BTC_TX_ID!,
  btcOutIndexStr: process.env.RGBPP_SPORE_BTC_OUT_INDEX!,
  receiverCkbAddress: process.env.RGBPP_SPORE_RECEIVER_CKB_ADDRESS!,
  sporeTypeArgs: process.env.RGBPP_SPORE_TYPE_ARGS!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE!,
});
