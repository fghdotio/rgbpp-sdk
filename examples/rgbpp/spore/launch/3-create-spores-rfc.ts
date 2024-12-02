import { RgbppClient2, BtcAssetsApiError } from 'rgbpp';
import { ckbNetwork, generateSporeCreateCoBuild, SporeCreateVirtualTxResult, remove0x } from 'rgbpp/ckb';
import { utf8ToBuffer } from 'rgbpp/btc';
import { serializeRawTransaction } from '@nervosnetwork/ckb-sdk-utils';

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

const RECOMMENDED_MAX_CKB_TX_SIZE = 60 * 1024;

const createSpores = async (args: {
  btcTxId: string;
  btcOutIdxStr: string;
  clusterId: string;
  receivers: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIndex, receiverInfos, btcFeeRate } = parseArgs(args);

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

  const ckbVirtualTxResult = await rgbppClient.sporeCreationCkbTx(
    btcTxId,
    btcOutIndex,
    receiverInfos.map((receiver) => receiver.sporeData),
  );

  const ckbTxSize = estimateCkbTxSize(ckbVirtualTxResult);
  if (ckbTxSize > RECOMMENDED_MAX_CKB_TX_SIZE) {
    throw new Error(
      `The estimated size(${ckbTxSize} bytes) of the CKB transaction is too large, which may cause the transaction to fail to be properly submitted to the blockchain. It is strongly recommended to reduce the number of Spore receivers to reduce the size of the CKB transaction to below 60K bytes.`,
    );
  }

  // Save ckbVirtualTxResult
  saveCkbVirtualTxResult(ckbVirtualTxResult, '3-create-spores-rfc');

  const { commitment, ckbRawTx, sumInputsCapacity, clusterCell, needPaymasterCell } = ckbVirtualTxResult;

  const btcReceiverAddresses = [rgbppClient.getBtcAddress(), ...receiverInfos.map((receiver) => receiver.toBtcAddress)];
  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: btcReceiverAddresses,
    needPaymaster: needPaymasterCell,
    feeRate: btcFeeRate,
  });

  const { txId: susBtcTxId, rawTxHex: btcTxBytes } = await rgbppClient.signAndSendBtcPsbt(psbt);

  console.log(`RGB++ spore creation BTC tx: ${susBtcTxId}`);

  let attempt = 0;
  const interval = setInterval(async () => {
    try {
      console.log(`Waiting for BTC tx and proof to be ready: attempt ${++attempt}`);
      const rgbppApiSpvProof = await rgbppClient.getRgbppSpvProof(susBtcTxId);
      clearInterval(interval);

      const ckbFinalTx = await rgbppClient.assembleSporeCreationCkbTx(
        ckbRawTx,
        susBtcTxId,
        btcTxBytes,
        rgbppApiSpvProof,
        clusterCell,
        sumInputsCapacity,
      );

      // The outputs[1..] are spore cells from which you can find spore type scripts,
      // and the spore type scripts will be used to transfer and leap spores
      console.log('Spore type scripts: ', JSON.stringify(ckbFinalTx.outputs.slice(1).map((output) => output.type)));

      const txHash = await rgbppClient.sendCkbTransaction(ckbFinalTx);
      console.info(`RGB++ spore has been created: ${txHash}`);
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
  clusterId,
  receivers,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIdxStr: string;
  clusterId: string;
  receivers: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutIndex = parseInt(btcOutIdxStr);
  if (isNaN(btcOutIndex)) {
    throw new Error('RGBPP_SPORE_BTC_OUT_INDEX is not a number');
  }
  const receiverInfos = receivers.split(';').map((receiver) => {
    const [btcAddress, sporeContent] = receiver.split(':');
    if (!btcAddress || !sporeContent) {
      throw new Error('Invalid receiver format');
    }
    return {
      toBtcAddress: btcAddress,
      sporeData: {
        contentType: 'text/plain',
        content: utf8ToBuffer(sporeContent),
        clusterId,
      },
    };
  });
  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIndex, receiverInfos, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcTxId, btcOutIndex, receiverInfos };
  }
};

const estimateCkbTxSize = (ckbVirtualTxResult: SporeCreateVirtualTxResult) => {
  const { ckbRawTx, clusterCell } = ckbVirtualTxResult;
  const rawTxSize = remove0x(serializeRawTransaction(ckbRawTx)).length / 2;

  const coBuild = generateSporeCreateCoBuild({
    // The first output is cluster cell and the rest of the outputs are spore cells
    sporeOutputs: ckbRawTx.outputs.slice(1),
    sporeOutputsData: ckbRawTx.outputsData.slice(1),
    clusterCell,
    clusterOutputCell: ckbRawTx.outputs[0],
  });
  const coBuildSize = remove0x(coBuild).length / 2;
  return rawTxSize + coBuildSize;
};

createSpores({
  // The cluster cell will be spent and the new cluster cell will be created in each spore creation tx,
  // so the cluster rgbpp lock args should be updated after each spore creation tx is completed.
  // The first cluster rgbpp lock args is from 2-create-cluster.ts and the new cluster rgbpp lock args can be found from the log in the line 71 of this file
  btcTxId: process.env.RGBPP_SPORE_BTC_TX_ID!,
  btcOutIdxStr: process.env.RGBPP_SPORE_BTC_OUT_INDEX!,
  clusterId: process.env.RGBPP_SPORE_CLUSTER_ID!,
  receivers: process.env.RGBPP_SPORE_RECEIVERS!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});
