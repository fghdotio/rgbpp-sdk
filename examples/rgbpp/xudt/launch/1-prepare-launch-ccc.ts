import {
  RgbppTokenInfo,
  buildRgbppLockArgs,
  calculateRgbppCellCapacity,
  calculateRgbppTokenInfoCellCapacity,
  genRgbppLockScript,
  getSecp256k1CellDep,
  newCkbSignerCCC,
  ckbNetwork,
  append0x,
} from 'rgbpp/ckb';
import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import { BTC_TESTNET_TYPE, CKB_PRIVATE_KEY, ckbAddress, isMainnet } from '../../env';

import { ccc } from '@ckb-ccc/core';
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils';

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

  // * rgbppLaunchLockScript's hash is the RGB++ Asset type script *args*
  const rgbppLaunchLockScript = genRgbppLockScript(buildRgbppLockArgs(outIndex, btcTxId), isMainnet, BTC_TESTNET_TYPE);
  const tx = ccc.Transaction.from({
    outputs: [
      {
        lock: rgbppLaunchLockScript,
        capacity: launchCellCapacity,
      },
    ],
  });
  console.log('rgbpp owner lock script', tx.outputs[0].lock);
  console.log(`this is RGB++ Asset type script's args`, append0x(scriptToHash(rgbppLaunchLockScript)));
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
  outIndex: 3,
  btcTxId: '51a00dcaae4b759e64beede3f51d59e82eb94126350667f3e68b788ab27e9b88',
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

/* 
rgbpp owner lock script Script {
  codeHash: '0xd07598deec7ce7b5665310386b4abd06a6d48843e953c5cc2112ad0d5a220364',
  hashType: 'type',
  args: '0x03000000889b7eb28a788be6f36706352641b92ee8591df5e3edbe649e754baeca0da051'
}
*/
// (ccc) Launch cell has been created and the CKB tx hash 0xcb60a5a303ef8c50a6bb96f64845321384d4182a3eaf3c8fd95ab68dcfe37cac
