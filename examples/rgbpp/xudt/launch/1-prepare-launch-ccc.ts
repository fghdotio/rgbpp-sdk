import {
  RgbppTokenInfo,
  buildRgbppLockArgs,
  calculateRgbppCellCapacity,
  calculateRgbppTokenInfoCellCapacity,
  genRgbppLockScript,
  getSecp256k1CellDep,
  newCkbSignerCCC,
  ckbNetwork,
} from 'rgbpp/ckb';
import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import { BTC_TESTNET_TYPE, CKB_PRIVATE_KEY, ckbAddress, isMainnet } from '../../env';

import { ccc } from '@ckb-ccc/core';

const prepareLaunchCell = async ({
  outIndex,
  btcTxId,
  rgbppTokenInfo,
}: {
  outIndex: number;
  btcTxId: string;
  rgbppTokenInfo: RgbppTokenInfo;
}) => {
  // const issuerOwnerLock = (await addressToScriptCCC(ckbAddress));
  // The capacity required to launch cells is determined by the token info cell capacity, and transaction fee.
  const launchCellCapacity =
    calculateRgbppCellCapacity() + calculateRgbppTokenInfoCellCapacity(rgbppTokenInfo, isMainnet);
  const tx = ccc.Transaction.from({
    outputs: [
      {
        lock: genRgbppLockScript(buildRgbppLockArgs(outIndex, btcTxId), isMainnet, BTC_TESTNET_TYPE),
        capacity: launchCellCapacity,
      },
    ],
  });
  tx.addCellDeps(getSecp256k1CellDep(isMainnet) as ccc.CellDepLike);
  const ckbSigner = newCkbSignerCCC(CKB_PRIVATE_KEY, ckbNetwork(ckbAddress));
  // pass `filter` explicitly to ensure type script is empty (although it's the default behavior)
  await tx.completeInputsByCapacity(ckbSigner, 0, {
    scriptLenRange: [0, 1],
    outputDataLenRange: [0, 1],
  });
  await tx.completeFeeBy(ckbSigner);
  const txHash = await ckbSigner.sendTransaction(tx);
  await ckbSigner.client.waitTransaction(txHash);
  console.info(`(ccc) Launch cell has been created and the CKB tx hash ${txHash}`);
  // console.log('Active handles:', (process as any)._getActiveHandles());
};

// Please use your real BTC UTXO information on the BTC Testnet
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet
prepareLaunchCell({
  outIndex: 1,
  btcTxId: 'c1f7fe5d4898194ed8ee5a38597cd28c7981e32e0e6aeb770f3f1b87df21434c',
  rgbppTokenInfo: RGBPP_TOKEN_INFO,
})
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/* 
npx tsx xudt/launch/1-prepare-launch-ccc.ts
*/
