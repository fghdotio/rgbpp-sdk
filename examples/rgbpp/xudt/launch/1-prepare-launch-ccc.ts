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
  // ! TODO: TMP WORKAROUND, FIXME
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
  await ckbSigner.client.waitTransaction(txHash, 0, 60000);
  console.info(`(ccc) Launch cell has been created and the CKB tx hash ${txHash}`);
  // console.log('Active handles:', (process as any)._getActiveHandles());
};

// Please use your real BTC UTXO information on the BTC Testnet
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet
prepareLaunchCell({
  outIndex: 2,
  btcTxId: '27be61caf5424dbcd8756556fc0376bed55575042168149908ab68a0de28a932',
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
NODE_NO_WARNINGS=1 npx tsx xudt/launch/1-prepare-launch-ccc.ts
*/

/* 
rgbpp owner lock script Script {
  codeHash: '0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248',
  hashType: 'type',
  args: '0x0200000032a928dea068ab0899146821047555d5be7603fc566575d8bc4d42f5ca61be27'
}
this is RGB++ Asset type script's args 0xdf31616c6d8e386d882ecd360c74c3d19d3ae83b9e6a8958cd5f909b77b08532
(ccc) Launch cell has been created and the CKB tx hash 0x0518822b8300098df87cbbc596ab29738c4a450c7dd3f6cd610a6220f193db5f
*/
