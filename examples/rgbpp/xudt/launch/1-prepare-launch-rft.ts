import { RgbppClient2 } from 'rgbpp';

import { ckbNetwork } from 'rgbpp/ckb';
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

const prepareIssuanceCell = async ({ btcTxId, btcOutIdxStr }: { btcTxId: string; btcOutIdxStr: string }) => {
  const btcOutIdx = parseInt(btcOutIdxStr);
  if (isNaN(btcOutIdx)) {
    throw new Error('RGBPP_XUDT_BTC_OUT_INDEX is not a number');
  }

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

  const tx = await rgbppClient.xudtIssuancePreparationCkbTx(RGBPP_TOKEN_INFO, btcTxId, btcOutIdx);
  const { txHash } = await rgbppClient.signAndSendCkbTransaction(tx, {
    confirmations: 0,
    timeout: 60000,
  });

  console.info(`RGB++ issuance cell has been created: ${txHash}`);

  console.log(
    `Execute the following command to issue the RGB++ xUDT asset (name: ${RGBPP_TOKEN_INFO.name}, symbol: ${RGBPP_TOKEN_INFO.symbol}, decimal: ${RGBPP_TOKEN_INFO.decimal}):\n`,
  );
  console.log(
    `RGBPP_XUDT_BTC_TX_ID=${btcTxId} RGBPP_XUDT_BTC_OUT_INDEX=${btcOutIdxStr} npx tsx xudt/launch/2-launch-rgbpp-rft.ts`,
  );
};

prepareIssuanceCell({
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

/* 
Usage:
RGBPP_XUDT_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_BTC_OUT_INDEX=<btc_out_index> npx tsx xudt/launch/1-prepare-launch-rft.ts

Example:
RGBPP_XUDT_BTC_TX_ID=abc123... RGBPP_XUDT_BTC_OUT_INDEX=0 npx tsx xudt/launch/1-prepare-launch-rft.ts
*/
