import { RgbppClient2 } from 'rgbpp';
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

import { CLUSTER_DATA } from './0-cluster-info';

const prepareClusterCell = async ({ btcTxId: _btcTxId, btcOutIdxStr }: { btcTxId: string; btcOutIdxStr: string }) => {
  const { btcTxId, btcOutIdx } = parseArgs(_btcTxId, btcOutIdxStr);

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

  const tx = await rgbppClient.sporeClusterPreparationCkbTx(CLUSTER_DATA, btcTxId, btcOutIdx);
  const { txHash } = await rgbppClient.signAndSendCkbTransaction(tx, {
    confirmations: 0,
    timeout: 60000,
  });

  console.info(`Cluster cell has been created: ${txHash}`);
};

const parseArgs = (btcTxId: string, btcOutIdxStr: string) => {
  const btcOutIdx = parseInt(btcOutIdxStr);
  if (isNaN(btcOutIdx)) {
    throw new Error('RGBPP_XUDT_BTC_OUT_INDEX is not a number');
  }
  return { btcTxId, btcOutIdx };
};

prepareClusterCell({
  // * Single-Use Seal
  btcTxId: process.env.RGBPP_XUDT_BTC_TX_ID!,
  btcOutIdxStr: process.env.RGBPP_XUDT_BTC_OUT_INDEX!,
})
  .then(() => {
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });
