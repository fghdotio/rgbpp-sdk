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
} from '../../env';
import { saveCkbVirtualTxResult } from '../../shared/utils';

import { CLUSTER_DATA } from './0-cluster-info';

const createCluster = async ({
  btcTxId: _btcTxId,
  btcOutIdxStr,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIdxStr: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIdx, btcFeeRate } = parseArgs(_btcTxId, btcOutIdxStr, btcFeeRateStr);

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

  const ckbVirtualTxResult = await rgbppClient.sporeClusterCreationCkbTx(CLUSTER_DATA, btcTxId, btcOutIdx);
  saveCkbVirtualTxResult(ckbVirtualTxResult, '2-create-cluster-rfc');

  const { commitment, ckbRawTx, clusterId, needPaymasterCell, btcOutIndex: susBtcOutIndex } = ckbVirtualTxResult;
  console.log(`cluster id: ${clusterId}`);

  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: [rgbppClient.getBtcAddress()],
    needPaymaster: needPaymasterCell,
    feeRate: btcFeeRate,
  });

  const { txId: susBtcTxId, rawTxHex: btcTxBytes } = await rgbppClient.signAndSendBtcPsbt(psbt);

  console.log(`RGB++ cluster creation BTC tx: ${susBtcTxId}`);

  let attempt = 0;
  const interval = setInterval(async () => {
    try {
      console.log(`Waiting for BTC tx and proof to be ready: attempt ${++attempt}`);
      const rgbppApiSpvProof = await rgbppClient.getRgbppSpvProof(susBtcTxId);
      clearInterval(interval);

      const ckbFinalTx = await rgbppClient.assembleSporeClusterCreationCkbTx(
        ckbRawTx,
        susBtcTxId,
        btcTxBytes,
        rgbppApiSpvProof,
      );
      const txHash = await rgbppClient.sendCkbTransaction(ckbFinalTx);
      console.info(`RGB++ cluster has been created: ${txHash}`);

      console.log(`RGB++ cluster BTC out index: ${susBtcOutIndex}`);
    } catch (error) {
      if (!(error instanceof BtcAssetsApiError)) {
        console.error(error);
      }
    }
  }, 30 * 1000);
};

const parseArgs = (btcTxId: string, btcOutIdxStr: string, btcFeeRateStr?: string) => {
  const btcOutIdx = parseInt(btcOutIdxStr);
  if (isNaN(btcOutIdx)) {
    throw new Error('RGBPP_XUDT_BTC_OUT_INDEX is not a number');
  }
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIdx, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcTxId, btcOutIdx };
  }
};

createCluster({
  // * Single-Use Seal
  btcTxId: process.env.RGBPP_XUDT_BTC_TX_ID!,
  btcOutIdxStr: process.env.RGBPP_XUDT_BTC_OUT_INDEX!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});
