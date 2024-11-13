import { RgbppClient } from 'rgbpp';

import {
  buildRgbppLockArgs,
  calculateRgbppCellCapacity,
  calculateRgbppTokenInfoCellCapacity,
  genRgbppLockScript,
  ckbNetwork,
} from 'rgbpp/ckb';
import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import {
  BTC_TESTNET_TYPE,
  CKB_PRIVATE_KEY,
  ckbAddress,
  isMainnet,
  BTC_SERVICE_URL,
  BTC_SERVICE_TOKEN,
  BTC_SERVICE_ORIGIN,
  BTC_PRIVATE_KEY,
  BTC_ADDRESS_TYPE,
} from '../../env';

// * TODO REMOVE
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils';

const prepareLaunchCell = async ({
  susBtcTxId,
  susBtcOutIndexStr,
}: {
  susBtcTxId: string;
  susBtcOutIndexStr: string;
}) => {
  const susBtcOutIndex = parseInt(susBtcOutIndexStr);
  if (isNaN(susBtcOutIndex)) {
    throw new Error('RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX is not a number');
  }

  // The capacity required to launch cells is determined by the token info cell capacity, and transaction fee.
  const launchCellCapacity =
    calculateRgbppCellCapacity() + calculateRgbppTokenInfoCellCapacity(RGBPP_TOKEN_INFO, isMainnet);

  const rgbppClient = new RgbppClient({
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
  const ckbClient = rgbppClient.getCkbClient();

  const rgbppLockScript = ckbClient.generateRgbppLockScript(susBtcOutIndex, susBtcTxId);
  console.log('(ccc) RGB++ lock script', rgbppLockScript);
  // * rgbppLaunchLockScript's hash is the RGB++ Asset type script *args*
  console.log(`(ccc) RGB++ lock script hash (RGB++ Asset type script's args)`, rgbppLockScript.hash());

  // * TODO REMOVE
  const rgbppLaunchLockScript = genRgbppLockScript(
    buildRgbppLockArgs(susBtcOutIndex, susBtcTxId),
    isMainnet,
    BTC_TESTNET_TYPE,
  );
  console.log('(ccc) RGB++ launch lock script', rgbppLaunchLockScript);
  const tx = RgbppClient.newCkbTransaction({
    outputs: [
      {
        lock: rgbppLaunchLockScript,
        capacity: launchCellCapacity,
      },
    ],
  });
  console.log('RGB++ owner lock script', tx.outputs[0].lock);
  console.log(`This is RGB++ Asset type script's args: 0x${scriptToHash(rgbppLaunchLockScript)}`);
  // * TODO REMOVE

  const ckbSigner = rgbppClient.getCkbSigner()!;
  // pass `filter` explicitly to ensure type script is empty (although it's the default behavior)
  await tx.completeInputsByCapacity(ckbSigner, 0, {
    scriptLenRange: [0, 1],
    outputDataLenRange: [0, 1],
  });
  await tx.completeFeeBy(ckbSigner);

  const { txHash } = await rgbppClient.sendCkbTransaction(tx, {
    confirmations: 0,
    timeout: 60000,
  });

  console.info(`(ccc) Launch cell has been created and the CKB tx hash is ${txHash}`);

  console.log(`Execute the following command to launch the RGB++ xUDT asset:\n`);
  console.log(
    `RGBPP_XUDT_LAUNCH_SUS_BTC_TX_ID=${susBtcTxId} RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX=${susBtcOutIndex} npx tsx xudt/launch/2-launch-rgbpp-ccc.ts`,
  );

  // console.log('Active handles:', (process as any)._getActiveHandles());
};

// Please use your real BTC UTXO information on the BTC Testnet
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet
prepareLaunchCell({
  // Single-Use Seal
  susBtcTxId: process.env.RGBPP_XUDT_LAUNCH_SUS_BTC_TX_ID!,
  susBtcOutIndexStr: process.env.RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX!,
})
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/* 
Usage:
RGBPP_XUDT_LAUNCH_SUS_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX=<btc_out_index> npx tsx xudt/launch/1-prepare-launch-ccc.ts

Example:
RGBPP_XUDT_LAUNCH_SUS_BTC_TX_ID=abc123... RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX=0 npx tsx xudt/launch/1-prepare-launch-ccc.ts
*/
