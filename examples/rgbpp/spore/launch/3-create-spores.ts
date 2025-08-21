import { BtcAssetsApiError, genCreateSporeCkbVirtualTx, sendRgbppUtxos } from 'rgbpp';
import {
  isMainnet,
  collector,
  btcDataSource,
  btcService,
  CKB_PRIVATE_KEY,
  ckbAddress,
  btcAccount,
  BTC_TESTNET_TYPE,
} from '../../env';
import {
  Hex,
  appendCkbTxWitnesses,
  appendIssuerCellToSporesCreate,
  buildRgbppLockArgs,
  generateSporeCreateCoBuild,
  sendCkbTx,
  updateCkbTxWithRealBtcTxId,
  RawSporeData,
  remove0x,
  SporeCreateVirtualTxResult,
} from 'rgbpp/ckb';
// import { transactionToHex } from 'rgbpp/btc';
import { saveCkbVirtualTxResult } from '../../shared/utils';
import { signAndSendPsbt } from '../../shared/btc-account';
import { serializeRawTransaction } from '@nervosnetwork/ckb-sdk-utils';
// import * as bitcoin from 'bitcoinjs-lib';

import { ccc } from '@ckb-ccc/shell';
import { generateSimpleDNA } from '../../shared/dob';

const RECOMMENDED_MAX_CKB_TX_SIZE = 60 * 1024;

interface SporeCreateParams {
  clusterRgbppLockArgs: Hex;
  receivers: {
    toBtcAddress: string;
    sporeData: RawSporeData;
  }[];
}

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

// Warning: Before running this file for the first time, please run 2-prepare-cluster.ts
const createSpores = async ({ clusterRgbppLockArgs, receivers }: SporeCreateParams) => {
  const ckbVirtualTxResult = await genCreateSporeCkbVirtualTx({
    collector,
    sporeDataList: receivers.map((receiver) => receiver.sporeData),
    clusterRgbppLockArgs,
    isMainnet,
    btcTestnetType: BTC_TESTNET_TYPE,
  });

  const ckbTxSize = estimateCkbTxSize(ckbVirtualTxResult);
  console.log('ckbTxSize: ', ckbTxSize);
  if (ckbTxSize > RECOMMENDED_MAX_CKB_TX_SIZE) {
    throw new Error(
      `The estimated size(${ckbTxSize} bytes) of the CKB transaction is too large, which may cause the transaction to fail to be properly submitted to the blockchain. It is strongly recommended to reduce the number of Spore receivers to reduce the size of the CKB transaction to below 60K bytes.`,
    );
  }

  // Save ckbVirtualTxResult
  saveCkbVirtualTxResult(ckbVirtualTxResult, '3-create-spores');

  const { commitment, ckbRawTx, sumInputsCapacity, clusterCell, needPaymasterCell } = ckbVirtualTxResult;

  // Send BTC tx
  // The first btc address is the owner of the cluster cell and the rest btc addresses are spore receivers
  const btcTos = [btcAccount.from, ...receivers.map((receiver) => receiver.toBtcAddress)];
  const psbt = await sendRgbppUtxos({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: btcTos,
    needPaymaster: needPaymasterCell,
    ckbCollector: collector,
    from: btcAccount.from,
    fromPubkey: btcAccount.fromPubkey,
    source: btcDataSource,
    feeRate: 28,
  });

  const { txId: btcTxId, rawTxHex: btcTxBytes } = await signAndSendPsbt(psbt, btcAccount, btcService);
  console.log('BTC TxId: ', btcTxId);

  /* const sumInputsCapacity = "0x1d208a4d6a"
  const clusterCell = {
    "blockNumber": "0x11645ba",
    "outPoint": {
      "index": "0x0",
      "txHash": "0x3cabd1a94c1b73147e27fa7dafe7e5cd7ab7e486a1db64fee5e84a9d1285b30a"
    },
    "output": {
      "capacity": "0x1d208a4d6a",
      "lock": {
        "args": "0x01000000b816ffcb4f531594c1ca46284adc5bdbbde56869d2abdcaee4076bf6311f2e03",
        "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
        "hashType": "type" as const
      },
      "type": {
        "args": "0xd808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
        "codeHash": "0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058",
        "hashType": "data1" as const
      }
    },
    "outputData": "0x54040000100000002600000054040000120000004e6572766170652d4f6d69676120546573742a0400007b226465736372697074696f6e223a224f6d696761206973206578636974656420746f20616e6e6f756e63652074686174205247422b2b20444f42207472616e73616374696f6e7320617265206e6f7720737570706f727465642e205468697320636f6c6c656374696f6e2077696c6c20626520666561747572656420696e204f6d696761e2809973207570636f6d696e672042544320436861696e2054726164696e6720436f6d7065746974696f6e2e222c22646f62223a7b22766572223a302c226465636f646572223a7b2274797065223a22636f64655f68617368222c2268617368223a22307831336361633738616438343832323032663138663964663465613730373631316333356639393433373566613033616537393132313331326464613939323563227d2c227061747465726e223a5b5b22707265762e74797065222c22537472696e67222c302c312c226f7074696f6e73222c5b22696d616765225d5d2c5b22707265762e6267222c22537472696e67222c312c312c226f7074696f6e73222c5b2262746366733a2f2f353435623934636231656366323137356238316336303133343665346137653035313439636166633666323335333330633939313865333566393230653130396930222c2262746366733a2f2f313162363330336562376438383764376164653435396163323739353937353463643535663966396535303334356365643865316538663437663435383166616930222c2262746366733a2f2f663233393762333565613264303530343538626337656339386463643364396333303231616139643434623963613163623434363733633465623763386566616930222c2262746366733a2f2f353839353030346539356338613462383066303566353331346433313030363761373033313334353135643832656666633265633665626130646461336663396930222c2262746366733a2f2f656233393130623365333261356564393436306264306437353136386330316261316238663030636330666166383365346438623637623438656137393637366930222c2262746366733a2f2f623031373535613134316464363565653261306233626434616136346131653365393934613363383262343232373164633564373031633438633637663664356930222c2262746366733a2f2f663164636530396262623631393631623363363165666266613236336133383531316366383964626465656432303666366563633030316135326331666230316930225d5d2c5b22707265762e6267636f6c6f72222c22537472696e67222c322c312c226f7074696f6e73222c5b2223453045314532225d5d2c5b2254797065222c224e756d626572222c332c312c2272616e6765222c5b31302c35305d5d2c5b2254696d657374616d70222c224e756d626572222c342c342c227261774e756d626572225d5d7d7d",
    "txIndex": "0x2"
  }
  const btcTxId = "a7a92e548470b72b95b079e87e60c1c02a479019bd7a35bfda7296e294a3c05a"
  const { hex } = await btcService.getBtcTransactionHex(btcTxId)
  console.log('hex: ', hex);
  const parseTx = bitcoin.Transaction.fromHex(hex);
  const btcTxBytes = transactionToHex(parseTx, false);
  const ckbRawTx = {
    "version": "0x0",
    "cellDeps": [
      {
        "outPoint": {
          "index": "0x0",
          "txHash": "0xf1de59e973b85791ec32debbba08dff80c63197e895eb95d67fc1e9f6b413e00"
        },
        "depType": "code" as const
      },
      {
        "outPoint": {
          "index": "0x1",
          "txHash": "0xf1de59e973b85791ec32debbba08dff80c63197e895eb95d67fc1e9f6b413e00"
        },
        "depType": "code" as const
      },
      {
        "outPoint": {
          "txHash": "0xcebb174d6e300e26074aea2f5dbd7f694bb4fe3de52b6dfe205e54f90164510a",
          "index": "0x0"
        },
        "depType": "code" as const
      },
      {
        "outPoint": {
          "txHash": "0x5e8d2a517d50fd4bb4d01737a7952a1f1d35c8afc77240695bb569cd7d9d5a1f",
          "index": "0x0"
        },
        "depType": "code" as const
      },
      {
        "outPoint": {
          "index": "0x0",
          "txHash": "0x3cabd1a94c1b73147e27fa7dafe7e5cd7ab7e486a1db64fee5e84a9d1285b30a"
        },
        "depType": "code" as const
      }
    ],
    "headerDeps": [],
    "inputs": [
      {
        "previousOutput": {
          "index": "0x0",
          "txHash": "0x3cabd1a94c1b73147e27fa7dafe7e5cd7ab7e486a1db64fee5e84a9d1285b30a"
        },
        "since": "0x0"
      }
    ],
    "outputs": [
      {
        "capacity": "0x1d208a4d6a",
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x010000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "args": "0xd808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
          "codeHash": "0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058",
          "hashType": "data1" as const
        }
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x020000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x03c8bf26b624a8b49d8c592c7f33b5cb76ad1aa7d8994db9a99ae25d67ed6737"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x030000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xb5a1c5cb28f68948e438c0760a616e671d605e8606dd0e28ed04719de38c4df9"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x040000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xb491c21d9957381b9124892636e08498a43924733d2bb8ba2e82171a7c290fa0"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x050000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xbd011e8468cb53b79d93c13cbb9d019d3aae13d9d4884c25501cb7e6c1e21c14"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x060000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x74565a14a626935b5eab87a21c8640da2d559b24aca836490d251082a61d8ab1"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x070000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xd1b3cecf1e768f1d9441632dcc24d92dceb642963060b77def229faf5c9b3dc4"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x080000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xc09b516294b448eb8a047042177b079944969c8b1d316ad913ef14ac1dd3d26a"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x090000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x37e378eadbed1c9e73282cc255840def0eabdae9a539457962e7c6f91c60d3ca"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x0a0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x64bf47eb6054783389e16596e5f07cc659602c360d5ecc6cd80121950646898b"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x0b0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x843ba0d0d1c38824f0a9fa1a048ef68060f955a60b63e8f52784e2712e4f1941"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x0c0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x298ddf67d1ada0c518c98b43e46057d075a0f80d589e3293bccf18edff0c5250"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x0d0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x3a098884640dd17af54fd7eb97fc158288da2c9b6d241206b124434a38749974"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x0e0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xb5ad21ce65f104c137236f7659ce7f10b415f7cf91232371b7e8617dd16995da"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x0f0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x1e718e908d7cbcff3c8ac7b91e9cb443727496a226193b82833dcf5e66ba10da"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x100000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x19a2d4584a95dbc2d685891bc1828b804f5ada8d52649d4f42186890f28819f4"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x110000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x2d4ddcb937c197ee6691fd9b2203cc1613cc86a77cb0039f39f3794c30b49cac"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x120000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x2fdeb0a4659ac68ea90d3fab99255e200fda9a1e88b76debe69d7fe5bd4f838f"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x130000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xbe60753f46bc7c0d9fddd771a0f93c66502827998d0526e9fca44c4cddfe4406"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x140000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x75011948109a1743626424ecc2265756175091f5a6de0bcffdcafdcfd42a7081"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x150000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xfe488141f60176df8083b8ad3a57e4c54d17ed9bfbec42c95005b27369ca2407"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x160000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xa6cb279ac97a489f6a986d8a288e75cb4f57d3832092850bf0d9bcf92b1c09f0"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x170000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x295838e8d741c48a074627523b33944561e0a9947b9ee0cecdf21351026c12e7"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x180000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xb9134351ea89be1b32ff51a5a9c957f583967012d30f75662fe6c22f510963ca"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x190000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x8dbef59c332d17981e3e68ed20e415e0ccbd777b9efc546874acf39e4a713f3e"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x1a0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x9350d53b3dffbe1a59e8040ef4e2ea53f6653bd77227da4bda60fdb7ae4d3b66"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x1b0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x6aa6a77559a4bd7fc5b85c7878e733f13f37066d9e23dee3304faa5be628a49a"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x1c0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xb4331fecfe016cd56dfac6c41c635171c9979d9fb16b32ce4cc9f4d56f170aec"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x1d0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x29e4b64e18455be6c9a804f52018d6cc554ab66fa6c9e25724f6d3d3c43e3d9e"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x1e0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x45e9b81bbc98e2f5316f97c579a5e77ffb5a3fee2eb300bee8742fe20254cd44"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x1f0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x7d4cf0b987ae30eccb6dba5ec047c0d97f3de586a88619baee96d7c366f2a97e"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x200000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x83de08a8f8a6ebb3796c92b61b4e882b5ce00dd9492aff0f97b3b6fb5ce772a6"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x210000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x8c78b35b66f7971f03a0a7fc85c8746a4f61ead7c14a522156aaec1201cacdd2"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x220000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x6d195fe9399d2eea3dc9369d699156673acb89fafdf486a519bb9f02d5d9e019"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x230000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xf7db755a49a9f5eef34f99d741238ef570025ef4d0c5e451840b50d108590704"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x240000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x90b724af31f8a7ffc6db026c293dbe1b1925b1ec1fc9a149bee9caf498d50785"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x250000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x597cffff7eae459db435cc2ae06a03288e2ef524d6e8b4084ea4c8e2056d9b6f"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x260000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x07a09b1ea7cb70070647bdbc089b51d1293f8ddb4694392a5b17f045943de233"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x270000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xe6c3b204893db0ec27919a21ab56c5f68d0f5f4a9f40877e2f8409d8cbb3f7f2"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x280000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x8b3279cafd6a973adffe344df2bba7ac1be48eed9d63849159cf020ccf281d4b"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x290000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xdf1b5ca8cd033864928a08b04c8871c65413c4e12a2fb382ee3d29c43a134d1b"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x2a0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x11b73a6e2a24c392295acf78ff4d793b93115d740108cf0b0e7f990ddd21d62d"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x2b0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xce7f72e0da443af1f7f7eacf39be29dc6d6fd172d34e70c3fdcb55f55dda6ed7"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x2c0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xbaa419f50ce12386093b5406317538312614ebdeb3f6c7994efd04d7356db1bd"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x2d0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x090f358c348bfc1837806c354dc093fcb4c3065d699f8ed3be725a9008f7d540"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x2e0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x15aea831d73c766b957a8b6e5a72c7de4b45a6276dbed4cb8973b5f88789b789"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x2f0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x230e4747808472f859f73559b80129ddc443f18af164db86a7c8e5d4e6d339a0"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x300000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x17102e4bd8f190856a7b40f18af3fa600921a8b042e91f40697ae9a5edc699c6"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x310000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x6124b156c43148b87f19f822b722616bfff51da9160e0cf6567c9dc26ba69edf"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x320000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x4654224f15da1eabeb598c0a1a38315eaf46f0dd4024c7e49ed8f1dc3c339d60"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x330000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x5ef9a990b8f8a4ad7994e8da7dedf0f731822d16af61ca2ab2baa9f93c5fd39e"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x340000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xd3f713acce23ecdf9cb3df26dda05de60d9efde2fe48f8795925b57c8719f313"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x350000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x0fcded3348ee804cd77d9df8af8a5d522df005c757246a7c0683aafd56ebfefa"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x360000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x7295e85d372296408b5a881034ee4044ccb732d10972bc724b81394ca0826bdb"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x370000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x87b8a3cc255d8927ccfb5d7a5c1519981c13401bb62dc21b7d4a8e57f05b1946"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x380000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xfe45e218f75630816a4debba5fd31abb4926c3c247bce9d662088618f8861b1f"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x390000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x897b37f01ce77834871ea9a16aac18a7e84d432ef606652233970458d6069110"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x3a0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x931d06a94be49a979248b249e846231eea7612916d29933b1d68fcabffef352e"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x3b0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x8468b510cacbef7765e5528e19672472d085fde264577a6b3dfb999ca3cdfc48"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x3c0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xad8bedca2680020b5873395b1caa32993230bbfd4ac153e59c1722fa49328731"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x3d0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xbd4d0f1a43b1b46bfaeb9dee2f813cde45951c3de704ae41db750bd5a0ea57a5"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x3e0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x9122a67b32c9003e462c1a3442c7da0f036e2a4fe386db881d637483fdfd10ae"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x3f0000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x9a85cf8af7310f096f3e4d7a1021e8067e22fdba8fdd55bc9d853c021dcacedf"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x400000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xf5f07e6ca069ed871040c4356fa64b8c29bffad26b1d4d9e113c4202632ed217"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x410000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xe7e3e11ef5a34159dbb35bf50cdf5601649101c6916190fe5b7f52e4ca0e0126"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x420000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xb3c6ef545d63927750072d76a850ba839e7e2ac6cf2685fa96d972cb69117521"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x430000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x9323d83862319db9b0a28749685637be8a0364ac558298b69c6aa6e55a1db659"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x440000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x33998afe1e0f33f108c9c80dc5389162386621696ad29db8f04b4c505be974b8"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x450000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0xecbc9f3af87f69fee8384624bf2f7fb5ee27043270ad47b68116493e72ea7028"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x460000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x9949d51c1907d4f66668df91cd5c4a935f1908ad76e1986d9b83b73eab3341a3"
        },
        "capacity": "0x7badfcc00"
      },
      {
        "lock": {
          "codeHash": "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
          "hashType": "type" as const,
          "args": "0x470000000000000000000000000000000000000000000000000000000000000000000000"
        },
        "type": {
          "codeHash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
          "hashType": "data1" as const,
          "args": "0x921f489e20b342ff6c948e2623066eaafc253a5d1e85e5a138957e0de4a86557"
        },
        "capacity": "0x7badfcc00"
      }
    ],
    "outputsData": [
      "0x54040000100000002600000054040000120000004e6572766170652d4f6d69676120546573742a0400007b226465736372697074696f6e223a224f6d696761206973206578636974656420746f20616e6e6f756e63652074686174205247422b2b20444f42207472616e73616374696f6e7320617265206e6f7720737570706f727465642e205468697320636f6c6c656374696f6e2077696c6c20626520666561747572656420696e204f6d696761e2809973207570636f6d696e672042544320436861696e2054726164696e6720436f6d7065746974696f6e2e222c22646f62223a7b22766572223a302c226465636f646572223a7b2274797065223a22636f64655f68617368222c2268617368223a22307831336361633738616438343832323032663138663964663465613730373631316333356639393433373566613033616537393132313331326464613939323563227d2c227061747465726e223a5b5b22707265762e74797065222c22537472696e67222c302c312c226f7074696f6e73222c5b22696d616765225d5d2c5b22707265762e6267222c22537472696e67222c312c312c226f7074696f6e73222c5b2262746366733a2f2f353435623934636231656366323137356238316336303133343665346137653035313439636166633666323335333330633939313865333566393230653130396930222c2262746366733a2f2f313162363330336562376438383764376164653435396163323739353937353463643535663966396535303334356365643865316538663437663435383166616930222c2262746366733a2f2f663233393762333565613264303530343538626337656339386463643364396333303231616139643434623963613163623434363733633465623763386566616930222c2262746366733a2f2f353839353030346539356338613462383066303566353331346433313030363761373033313334353135643832656666633265633665626130646461336663396930222c2262746366733a2f2f656233393130623365333261356564393436306264306437353136386330316261316238663030636330666166383365346438623637623438656137393637366930222c2262746366733a2f2f623031373535613134316464363565653261306233626434616136346131653365393934613363383262343232373164633564373031633438633637663664356930222c2262746366733a2f2f663164636530396262623631393631623363363165666266613236336133383531316366383964626465656432303666366563633030316135326331666230316930225d5d2c5b22707265762e6267636f6c6f72222c22537472696e67222c322c312c226f7074696f6e73222c5b2223453045314532225d5d2c5b2254797065222c224e756d626572222c332c312c2272616e6765222c5b31302c35305d5d2c5b2254696d657374616d70222c224e756d626572222c342c342c227261774e756d626572225d5d7d7d",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226635666636643833643133303565386122207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223038613962373234626566613565613022207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223362623234316631343932623331376122207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223230633863383832353437613039316122207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223961666437333134383730613930346322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226264663335663433356135633138666422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223264343031626538363666346634646622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223666626134363961623432626232663922207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223130356464303538306165333661396622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223536313764353965633861366530386522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226138666439323262386163376539353422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223535336234616464393062393362333522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223734663636346439343331633130353822207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223138666562653434336632623034626322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226165653465633865383439386539633622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223765643230346462303131383733656222207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226162303835376431366235353236616322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223737653137366564623438353535653322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226665353830306230353761663336653622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223962643533383430653432333163643522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223138306434666363613139643036396522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226134306530323762663163333366373222207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223036333532663161326362336366343522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223963366631613231393432323265386522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223265653934613362383236356636636322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223437363139656133376665366136383822207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223633346332383439666434386566666522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223961363837643837623762393839303022207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226631643264343437396231366335646422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226163313865393235343735316338306322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223831653865633265626539636130306522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223437616265356438323362313066616522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226365373264663338376463356565643122207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226164353063366536363737376534333522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226136373230353466343465656331623322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223937616131613262313363643161356322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223539626462396164613039303831393822207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223832313435366562663337346130653622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223432643930613961386463393461383922207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223533303064616135636333613064643522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223333363337346566363365316266303022207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223364326334363465346464383861383022207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223330353436396266353264666230306122207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223839623562613634623530613933393022207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226563356530653463666534313763376522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226235343531653662636630353135643122207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226538616236316631316235386364353422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223162636236333534666130623336633822207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223533373538643835643465336134323922207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223365653366643733653135346465303722207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223339356131663334303636386136316522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223931333463626439353164366336306622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223361363862636538663335306233336222207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223534613865376439346561356238643622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223463336336656463383837303336336422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223265333266356264383030646434303722207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226366646430363661356130396236323522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223464326530373663653762396430363722207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226438356631626335616335366364353322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226631376437343530313064623432643422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223063613831383963663236653134623222207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223830393631373832633839383961336422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226137313666376136316331333436356422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226238366530363232363936656565376622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223234346630653133383961393065613722207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226261386161373166393862303765333822207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20223733623034333732396235623832356622207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226632646438323731663934356636626522207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226131376536373664653332326337356422207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf",
      "0x5e00000010000000190000003a00000005000000646f622f301d0000007b2022646e61223a20226364343335386336333230316633333322207d20000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf"
    ],
    "witnesses": [
      "0xFF",
      "0x010000ffd84900000c0000001000000000000000c849000008000000c04900002001000062020000670300006c04000071050000760600007b07000080080000850900008a0a00008f0b0000940c0000990d00009e0e0000a30f0000a8100000ad110000b2120000b7130000bc140000c1150000c6160000cb170000d0180000d5190000da1a0000df1b0000e41c0000e91d0000ee1e0000f31f0000f8200000fd21000002230000072400000c25000011260000162700001b28000020290000252a00002a2b00002f2c0000342d0000392e00003e2f000043300000483100004d32000052330000573400005c35000061360000663700006b38000070390000753a00007a3b00007f3c0000843d0000893e00008e3f000093400000984100009d420000a2430000a7440000ac450000b1460000b6470000bb480000420100001000000030000000500000006bc165c0dc6a5398b44f02cd03aa48987e88cc10d97edfeb1ab883e6cf6fc565326a44e195f4a1e4f56eabda38b1c7e026433615d69f344a7a8c590ad2129a1aee00000004000000ea00000010000000300000008d000000d808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000001000000b816ffcb4f531594c1ca46284adc5bdbbde56869d2abdcaee4076bf6311f2e03000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000100000000000000000000000000000000000000000000000000000000000000000000000501000010000000300000005000000088ea735ad5149d58fadd6f40c7f06dcd7fcd1d168a4f98722bcb024195641dab56c7980ade379ad10326594971bff5ec32c24efb3ce471cb447c659000263bf4b100000000000000ad00000010000000300000008d00000003c8bf26b624a8b49d8c592c7f33b5cb76ad1aa7d8994db9a99ae25d67ed6737000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000020000000000000000000000000000000000000000000000000000000000000000000000b367621c7784de55d7228a6f814102de87b413acec09b2d0dc4113b6552d801a0501000010000000300000005000000002ad6211426dd4760ac3f8f5dc86d039ea814e30d37292344b1ec5845877908ba37c3f0053b525839335372b5d38d7e6aa99d9abf0ae07e9fdbf52f22548c8b2b100000000000000ad00000010000000300000008d000000b5a1c5cb28f68948e438c0760a616e671d605e8606dd0e28ed04719de38c4df9000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000030000000000000000000000000000000000000000000000000000000000000000000000a17f90535ea51341a76dc1d2cd5c1996f9907888ad6b97d6deedcf32b39a30f905010000100000003000000050000000d1480cbc4fd311de5e5990f20aa26c0a6f283bf40b3ff135f55c4cb5027669215b15e506a1231885269e4e75f7c427e3d0043d6184b624bd98554df96c4b3c95b100000000000000ad00000010000000300000008d000000b491c21d9957381b9124892636e08498a43924733d2bb8ba2e82171a7c290fa0000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000040000000000000000000000000000000000000000000000000000000000000000000000eb14186b2db97ac990c67e44547e0a6e401dccb6a69b1d2acfd8fbbdc3060c19050100001000000030000000500000004809aad3d5f376fc196cf7678c1a67f28a9bf510384587f8a36c9294160cabf8f0bef3bdbc0d235474e59ccee8bdb681f1bcbb28aa166f35a6365d827191a49ab100000000000000ad00000010000000300000008d000000bd011e8468cb53b79d93c13cbb9d019d3aae13d9d4884c25501cb7e6c1e21c14000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000005000000000000000000000000000000000000000000000000000000000000000000000084d289b7b4aeec0b325f7e29191b6e8f55f3fef827bedf29a3b4f011ad5591d305010000100000003000000050000000b32dd0f6513feb98c1e60fb27fbb552053cd9d8be5d9b40456f9611a2623ae5f81d3d0079d50da0d1cfd4eb2c53b8f684612700f2dc3a17c4771c14278b6976db100000000000000ad00000010000000300000008d00000074565a14a626935b5eab87a21c8640da2d559b24aca836490d251082a61d8ab1000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000006000000000000000000000000000000000000000000000000000000000000000000000056631f426e30094fe5a1e06e0f4c7220bd9d20e5deea212a56dae62d2ed0828605010000100000003000000050000000de516daf16d2aa4c5c838685e4feb8dc78d5e0bacb8892d2d73c06669f757127a8779012c90a6d46c1633905a3c9f13b12e11886c88bc784102f5790f2949197b100000000000000ad00000010000000300000008d000000d1b3cecf1e768f1d9441632dcc24d92dceb642963060b77def229faf5c9b3dc4000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000070000000000000000000000000000000000000000000000000000000000000000000000cc28dd367c7be2b30568dd4a2588dec5a5a519fea47b8aa4cc16ce7255fbb9a60501000010000000300000005000000027455dca376ec5c11ab343a6a94004999b25215d224a5b1ba598a8f26c522c4f162870400b16174cb7b1ae8f44bc3c38c3c405e4133c22fe01967d62c162e4aeb100000000000000ad00000010000000300000008d000000c09b516294b448eb8a047042177b079944969c8b1d316ad913ef14ac1dd3d26a000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000800000000000000000000000000000000000000000000000000000000000000000000007436892ed8a787103cb8ba9b110c094f8aa8d7267c9d6509fa0cc44f98b9a8810501000010000000300000005000000000e94b6e0cae3d0b4584c592830471477c373f10df8c8fe8e9d1f62eecac047faa94fb794f66ffee8ddc13f408aa82496224deb27197c238f569df9b02aaaa64b100000000000000ad00000010000000300000008d00000037e378eadbed1c9e73282cc255840def0eabdae9a539457962e7c6f91c60d3ca000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000900000000000000000000000000000000000000000000000000000000000000000000007a85123a611986c40b846b571787cbbfc0c5c456f18f4be7af30b404e4bd9d5f050100001000000030000000500000000349617cbf5a36dbae53d9354f982fc3a2a013705cd28fc3049392d0a46a58d3211b85c4c2dd85043ce5814de076fa2bb755bb674640374f4f1bb6a362613d4ab100000000000000ad00000010000000300000008d00000064bf47eb6054783389e16596e5f07cc659602c360d5ecc6cd80121950646898b000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000a0000000000000000000000000000000000000000000000000000000000000000000000e0884e6415fb623e3a1d586e0ed382fa82254f3f6598f2605b7e8167b45b47f00501000010000000300000005000000016fe2bccadce0558e24c580f748d66e72699e8cb3e95c1f0d8fe1af64ad58f566c295ba0ff26e23d0204f96a8da7be5ddd93a56b7d1879fcdd6a381bf764dc87b100000000000000ad00000010000000300000008d000000843ba0d0d1c38824f0a9fa1a048ef68060f955a60b63e8f52784e2712e4f1941000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000b00000000000000000000000000000000000000000000000000000000000000000000003d2bb81f514ce20c7f195a3f2e90c201bb46632d0f1d14e97e3797148aaf29990501000010000000300000005000000063545c47e287f82c7ef4b28eb3d4a2981926ad4c6baefa1d31bb3beea2b9cfc73baf8e294b86e4bb6d40593a76a5e871798bb92d95ebd8ced2cea3e8be6b8cabb100000000000000ad00000010000000300000008d000000298ddf67d1ada0c518c98b43e46057d075a0f80d589e3293bccf18edff0c5250000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000c00000000000000000000000000000000000000000000000000000000000000000000009e34bbec4e79f1dd43877b831985da40b6550c19a1e009f7a44e0fc8dc20952d05010000100000003000000050000000d4e964b654177b776001ebfe4536c17c72c5d6df5c5e47a96d8ce83c0dee12c63c2de93489d4a36d782c372084a57219b684b87acead44cbeaaa09f2c04b2ac8b100000000000000ad00000010000000300000008d0000003a098884640dd17af54fd7eb97fc158288da2c9b6d241206b124434a38749974000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000d000000000000000000000000000000000000000000000000000000000000000000000018ecf5710182c1aff608dee25da5a44ac3c5ad68c008f14a420ddb706d2eaae6050100001000000030000000500000009d4abf162154da6494a16e02cab68a8da63e219861e1911efa9df07b19f35e0afbf06a94007b8a6ae0647656942a6b47c1a147af1917f86bed8eb84553192bb2b100000000000000ad00000010000000300000008d000000b5ad21ce65f104c137236f7659ce7f10b415f7cf91232371b7e8617dd16995da000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000e000000000000000000000000000000000000000000000000000000000000000000000095479931babf05381780dfbb5005acc058354e63d246ffc61a635137ef9437d9050100001000000030000000500000003be9c89404f279f6fd0c4f16ff1512aa984297a12321c4ef285108a85d0c8329d280f3892b9ceb442c1c9cbe168a4c611f7c3a023a8d7d58f0aee949fd919260b100000000000000ad00000010000000300000008d0000001e718e908d7cbcff3c8ac7b91e9cb443727496a226193b82833dcf5e66ba10da000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000000f00000000000000000000000000000000000000000000000000000000000000000000008e8641ed097e11e07df65e6d7f7472265909bfbb2acb76a63beff5265269590c05010000100000003000000050000000e3e32fc34f435f85acd996c820354fae58c88695cab311734bf0ac55b7e3a94241d2c7aad2f4125f4e20210d3492474205bb58573608ce2f1b0364b300055da0b100000000000000ad00000010000000300000008d00000019a2d4584a95dbc2d685891bc1828b804f5ada8d52649d4f42186890f28819f4000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000010000000000000000000000000000000000000000000000000000000000000000000000099de45d922435d81c84d575229b85eb120f21d3be6c1cdfc77fd05d0bc2fe19705010000100000003000000050000000842b1fed7e14103257bd65efc0ebfdf589f3ae014ab16b6d448f1c18bf0c4346bdffdc8d7ed30918e7152024729f924d6a52c4e2aba8cc44a1303cc361c78102b100000000000000ad00000010000000300000008d0000002d4ddcb937c197ee6691fd9b2203cc1613cc86a77cb0039f39f3794c30b49cac000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000110000000000000000000000000000000000000000000000000000000000000000000000e04cdf03c09714dcf562d9da2084a57f41f7188613ed009893399e88ea152aee0501000010000000300000005000000050f782fb50a92873bb771522d4fbb3d403e9cd1a49d7178a9e8deb0f000d28b65e48a7e16b1fb08a59c79ba38f3aa7e1ab3de596d83c73beec883df76bb179abb100000000000000ad00000010000000300000008d0000002fdeb0a4659ac68ea90d3fab99255e200fda9a1e88b76debe69d7fe5bd4f838f000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000120000000000000000000000000000000000000000000000000000000000000000000000e54efa86cf12eec7731a28a3458585288de59d2a0c921344131a2ebf7da730c70501000010000000300000005000000057d099d959d70e6e5be71d1d3c32144e9d16a285d7718b59ac004ed1691094f9f9e8ec4ed803492bf1ad637df4e4ea722c13c98214fd283b2cd099e7bed40063b100000000000000ad00000010000000300000008d000000be60753f46bc7c0d9fddd771a0f93c66502827998d0526e9fca44c4cddfe4406000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000013000000000000000000000000000000000000000000000000000000000000000000000068ba828c153534f9eaa897fdbbfde7dcebfa722cd3a6339d1cc3b3fa7f7c7e13050100001000000030000000500000008e9087c4554509d9dae79b7149547ebd478c1b823cc49c9b30570936aa1d00f331bd60c8f13ea261212883db789a0c8f6daa20cb61c3121f2e5698b1d6366900b100000000000000ad00000010000000300000008d00000075011948109a1743626424ecc2265756175091f5a6de0bcffdcafdcfd42a7081000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000140000000000000000000000000000000000000000000000000000000000000000000000f48ac23513c62dedb5327287e3f2ebe77b68434087cfb455b6f596960c30d307050100001000000030000000500000001c369400aad263ca502157ae2a70e61fc03ef5732aa072152df80556524c665f444aa901c0d408077ff3241b23e9d8da75ad83073fdee673c8c0b88db4da06e5b100000000000000ad00000010000000300000008d000000fe488141f60176df8083b8ad3a57e4c54d17ed9bfbec42c95005b27369ca2407000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000150000000000000000000000000000000000000000000000000000000000000000000000d60ce463701393d7f2f1c2a24fb637804aeabec1e8c3ac4ff20e903c554e016305010000100000003000000050000000f76d4e965034e440db3a4ff594f7778fd10b6d79299d9bacf53b11b7e8522074c4233803135794804bffad1d5991ce1685e1c764f0b85818384bc196f5bb1d78b100000000000000ad00000010000000300000008d000000a6cb279ac97a489f6a986d8a288e75cb4f57d3832092850bf0d9bcf92b1c09f0000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000016000000000000000000000000000000000000000000000000000000000000000000000041229df4f7dfc3a3ac2567f41c7ac41e2b405a80a94c51e3c76cce442d6f14ee050100001000000030000000500000006a593df88d6667a8ae87ff6ac0899287c1e0e5940e8d24a3e70df031caa5ce555e1bf289a713eec7364da101f71e81ec4981a421635a938343a6f00b66e67cd4b100000000000000ad00000010000000300000008d000000295838e8d741c48a074627523b33944561e0a9947b9ee0cecdf21351026c12e7000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001700000000000000000000000000000000000000000000000000000000000000000000005c1b85a26d555553dc90c6e30bdaca98364ad1a33fe5e19995b69d9c35e00ea705010000100000003000000050000000b600856740ca06be36cc3b64db4bf7eb77ca1998143535d0da41f31e6beeab104ab39fa5e912da6860dfcf7fb245abac203ce3e53e5760a989d358a0236231dfb100000000000000ad00000010000000300000008d000000b9134351ea89be1b32ff51a5a9c957f583967012d30f75662fe6c22f510963ca000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001800000000000000000000000000000000000000000000000000000000000000000000007f86eca26e1fc02e6e19461813d140288e271556906c16e2000292f2e5e8a67305010000100000003000000050000000d3d95c52ce01e3e295bbb978a9168b9835326acba7e08af2bd3fd33c01807d3c71445d86da5f805d357a5fc8e495e53dd16c667b1fae589e160bdddee88bb44ab100000000000000ad00000010000000300000008d0000008dbef59c332d17981e3e68ed20e415e0ccbd777b9efc546874acf39e4a713f3e000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000190000000000000000000000000000000000000000000000000000000000000000000000ab0e0e8927500a34cb1d9f6a5ffbd0ba4170b13a109092c6a9354c9d3cb52c1f05010000100000003000000050000000f04579c79d415a3b2ceb875ff6dea2f24e29444846096cd4f48ec8e8987302248bcf5fda7fdabb4e00b66cd057ca7ce9eaf5f80885d9017f6b5430617d3625c3b100000000000000ad00000010000000300000008d0000009350d53b3dffbe1a59e8040ef4e2ea53f6653bd77227da4bda60fdb7ae4d3b66000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001a0000000000000000000000000000000000000000000000000000000000000000000000f7a2b8fa61941754445786d17f0078f9acfbf9fb27275ad0fecde03b5fb13990050100001000000030000000500000000fb687b4286879192468ac7e4f69863fab4b0972d99cf83b3ae1f1aebe16e32e76faab7291c307543292676a4775d0a5ed976474f1c872669a5755a84b5314b1b100000000000000ad00000010000000300000008d0000006aa6a77559a4bd7fc5b85c7878e733f13f37066d9e23dee3304faa5be628a49a000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001b0000000000000000000000000000000000000000000000000000000000000000000000b0e665f3285029f3b1ffa994e044e5eb4b5e927ccc2dc9c0993113ff783190f2050100001000000030000000500000002bd4633060288f99eaf30bd41e2181ebe6162680484a8e8434031dc16941084417c3a437b3477c326cb1747523884fb5cf19124f80c311bc50ac3bab4866cfc0b100000000000000ad00000010000000300000008d000000b4331fecfe016cd56dfac6c41c635171c9979d9fb16b32ce4cc9f4d56f170aec000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001c00000000000000000000000000000000000000000000000000000000000000000000008fa81d99c7da414e6e8b74d54abe5e7c390b0f494b1d5315aa079c44b74f9008050100001000000030000000500000008f72212fb902e1fd1dccc5c4a6b017f4bf7ef9830d19ac65ab3d6b86896732ddb9faa5ef59dbc4ce1f61d4fadb9438b361c544f8dc9e7d60f3ed1daeca010be5b100000000000000ad00000010000000300000008d00000029e4b64e18455be6c9a804f52018d6cc554ab66fa6c9e25724f6d3d3c43e3d9e000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001d0000000000000000000000000000000000000000000000000000000000000000000000db3391259c7053cc00f0cf72bfcadfb6b3a848c79f8ab5c2d5185df83682cd5e050100001000000030000000500000001340ce076737214e5b80bb030a642582b4cbd3e121ce0a942e19a0266d9215c8484e45747aff61ab196e6bc9eeb563225dee6339ef379e28376c6b44b56ccd9ab100000000000000ad00000010000000300000008d00000045e9b81bbc98e2f5316f97c579a5e77ffb5a3fee2eb300bee8742fe20254cd44000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001e0000000000000000000000000000000000000000000000000000000000000000000000e17d760c12eb14da6297eab4221b189dd853d7e78a9d393137f2a0755610b1100501000010000000300000005000000028b6155ac5ba013504310ead1ea4275140a6593be7abf9720257a53ef4ed093675cdacf4d62b2eaa844b9c001893ba9deea794f8e4e88df7e7ff6b828eaa63c5b100000000000000ad00000010000000300000008d0000007d4cf0b987ae30eccb6dba5ec047c0d97f3de586a88619baee96d7c366f2a97e000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000001f00000000000000000000000000000000000000000000000000000000000000000000005121e8f1ab3f51929e45f20993ebc703e0a4a0af999aa28ab6951cce58a544070501000010000000300000005000000036d79da9753a16ba5b1246b56bbb6de7df2b53dfb7c714f6590a4c245be25b9394c32e72a40a1385e0a92fb68a0d023ac9fca62af13dc23d1d2154aa8135528fb100000000000000ad00000010000000300000008d00000083de08a8f8a6ebb3796c92b61b4e882b5ce00dd9492aff0f97b3b6fb5ce772a6000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000200000000000000000000000000000000000000000000000000000000000000000000000a30ad49afc91570c03bf448b8ec14be5f2f9f88ceef2bb939d7c8db3a716b210050100001000000030000000500000009a0469332bcb140418e4504f9a0a570c676cfa9c29ae3698c912227d614c001a0339e659e550ba6df8c4886dd66e57425ea6bda899a60b1d95d6c5eff5a755c0b100000000000000ad00000010000000300000008d0000008c78b35b66f7971f03a0a7fc85c8746a4f61ead7c14a522156aaec1201cacdd2000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000210000000000000000000000000000000000000000000000000000000000000000000000d093a558064f8723bb388092a9c4529046ef164c2e93f107089f7d3791a17bc305010000100000003000000050000000d1ce32d3bb82ee6aa15ab3c49367e4680437abb6d9b44487249d797437ab0258b39718ac2b248eca6e7ddc9d1a5d7e0ee7c8bd7271a6c8af2ebaa115a5d7c4b6b100000000000000ad00000010000000300000008d0000006d195fe9399d2eea3dc9369d699156673acb89fafdf486a519bb9f02d5d9e019000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000220000000000000000000000000000000000000000000000000000000000000000000000e21c8ae453712d0916e3e3aa814861f167c1c0e82489a51337dc2b8a2b51b3fd05010000100000003000000050000000bf0ae1fa0765e0a220a42bb2e0b8672ded0d4eac623a38e26b6fc7a96597335042dd2ae394584236f00c3bb552abcd586f6a0c699e9983075698f4ba1808793cb100000000000000ad00000010000000300000008d000000f7db755a49a9f5eef34f99d741238ef570025ef4d0c5e451840b50d108590704000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000023000000000000000000000000000000000000000000000000000000000000000000000078211e70351b6b056d57ca10f083c0ccb1266639f6e94193e501b628c6da49140501000010000000300000005000000060fb775f140b41e4a9614f12547db8d3a1ccf36acaa334c6d43f996d766f25b101c5ee1cfc181695886fcace8d5574d4f94633b8c333d1d11a77c462f6326bdab100000000000000ad00000010000000300000008d00000090b724af31f8a7ffc6db026c293dbe1b1925b1ec1fc9a149bee9caf498d50785000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000240000000000000000000000000000000000000000000000000000000000000000000000cba589cc40183b9c126b7b116481b734ff4372e31fb801c887ce5909001be40c050100001000000030000000500000004cf77e40529e5a7d25fe505d1310fa6e2e1e6b03668da51254a8ee39ce494c4d1442f2e28d9248d6f6deaab20ffbe35b1b6187cf381d1d515d2fa347c17359dab100000000000000ad00000010000000300000008d000000597cffff7eae459db435cc2ae06a03288e2ef524d6e8b4084ea4c8e2056d9b6f000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002500000000000000000000000000000000000000000000000000000000000000000000003ca66d7888fd155c746cc726bdf691338e83959c1410611700eeb39a89f2faba0501000010000000300000005000000093f5487c840f286dacc50fc62a6ba98baa6ddcc0e84d61ab6b7b6ccd62551bb0b18b21d172311823602c8c1fbbe45020c4d1e039c4e30a5d148402f0b9b3a4dbb100000000000000ad00000010000000300000008d00000007a09b1ea7cb70070647bdbc089b51d1293f8ddb4694392a5b17f045943de233000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000260000000000000000000000000000000000000000000000000000000000000000000000e28dd16dccdb2d7a2eebc83888a32f05a2c9a009fe487f4c25ca21fad6b954de05010000100000003000000050000000de413623489d7b568c0141046654413bcaa99cc76b393802de41b2486961342e3f5c1b04f9a560b778e2af2a7e09af566e6924ea729b07a382c71acb0089fc32b100000000000000ad00000010000000300000008d000000e6c3b204893db0ec27919a21ab56c5f68d0f5f4a9f40877e2f8409d8cbb3f7f2000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000270000000000000000000000000000000000000000000000000000000000000000000000b3aedd8751cd1737da8d5ca3a053ee9a839674757f3e0bc6a2bb556c67ec2ee105010000100000003000000050000000b57bccc4d104e5de75aa7232c3d431cccfe94fd226b25787d380879e74113e6a9d5434c8618cff270e892be5ef150203d6d7db8279a78ec18696c3f267c0c922b100000000000000ad00000010000000300000008d0000008b3279cafd6a973adffe344df2bba7ac1be48eed9d63849159cf020ccf281d4b000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000280000000000000000000000000000000000000000000000000000000000000000000000543c2767f0b0e6e615e4cb1c91ab12099d59fffffce1d7942e6340c5ffdc1fd105010000100000003000000050000000f3a0ab112a1fed8cfda70eecf957eb8e706f68b664aacccfdd65682a96d6d8eae210c44264bdea3e855925112f0da375f48311bf3129ea389d0abcee31f54434b100000000000000ad00000010000000300000008d000000df1b5ca8cd033864928a08b04c8871c65413c4e12a2fb382ee3d29c43a134d1b000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002900000000000000000000000000000000000000000000000000000000000000000000000a0ae42b3197b7e7f8a925c7793421eabe920f5a810f6114ae6671122dfae9d305010000100000003000000050000000739c9a3191915862a42994db6248e7ca99a41bf0f99f5f3e541e7913e95a24816eb3375017cbceb2e6ea1912a93d23f5e5057794846851ff14ae6512278e3989b100000000000000ad00000010000000300000008d00000011b73a6e2a24c392295acf78ff4d793b93115d740108cf0b0e7f990ddd21d62d000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002a000000000000000000000000000000000000000000000000000000000000000000000038876cf33a15c7a48eb21ccf72a656b4a36459dd93bb24b0c6d608b4e816ca62050100001000000030000000500000006959619e3d24d79f768610c13db0bb2dde246e1dc14f8cc8c4f838a93d80684bcff166f0686df12c42bcc4f300f66dcf1a5afdd0c9cffa64442c5200d9d364a3b100000000000000ad00000010000000300000008d000000ce7f72e0da443af1f7f7eacf39be29dc6d6fd172d34e70c3fdcb55f55dda6ed7000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002b0000000000000000000000000000000000000000000000000000000000000000000000f73dab59138672dd2d2d1f1fc05c796333f7b06239092f2eae91820d52aef409050100001000000030000000500000004e8ee9367650e6b397827737b4c31340abf4033615f42a373ac99448276f9fe22e3f6b27e528636d53ccd32a6a07cc653f28dac933f5222ca9074f7414c0d1f9b100000000000000ad00000010000000300000008d000000baa419f50ce12386093b5406317538312614ebdeb3f6c7994efd04d7356db1bd000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002c000000000000000000000000000000000000000000000000000000000000000000000004ec4f3946e13dc8b20875ff93c40155db8b2408ed22c6caddf1cf178e5ea4cf0501000010000000300000005000000052a4ed0dc90ffdf7a850ec316c3de3f4a8e30ba32417648e83a0c132014bee7cf72050c1e77153cd6e606764133d9425530e25fa785a3dc0cb05942c0ef924b7b100000000000000ad00000010000000300000008d000000090f358c348bfc1837806c354dc093fcb4c3065d699f8ed3be725a9008f7d540000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002d0000000000000000000000000000000000000000000000000000000000000000000000f7215044a80f67164aa3775177aac5834d11e65908208430cc930d6061d3971b0501000010000000300000005000000094d7cf25b1dca01a0067bebfef192d3112147bb022d4bc4422cd90ed6eeb7c3737697d35b10eadd85ed8ef33659faf25e35379346e1216c237dc9e626bb3b66bb100000000000000ad00000010000000300000008d00000015aea831d73c766b957a8b6e5a72c7de4b45a6276dbed4cb8973b5f88789b789000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002e0000000000000000000000000000000000000000000000000000000000000000000000018105b6f09e625ead592634d04ba62a4cea095d77101ddda2f098eb8bc73dea05010000100000003000000050000000e662179fef3e2b32877fd445589f88fad43140799aaae264a444610d56dfa26a532332e28e6ecf8dab99d6dff6969c3e554cd10a41c4825a2eee168f9aba3054b100000000000000ad00000010000000300000008d000000230e4747808472f859f73559b80129ddc443f18af164db86a7c8e5d4e6d339a0000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000002f0000000000000000000000000000000000000000000000000000000000000000000000d9bdef28432717e1048e61c0636f3e984f0604c823c19b309c77e1a17855d2fa05010000100000003000000050000000d3c6d3ebe43ed38a2abeb9112b3a6ee58a1290cd9ca07133b4500d1fecd94931ca24730de452f97673de029011cea283bce363b55c48537d55d45775571c11eeb100000000000000ad00000010000000300000008d00000017102e4bd8f190856a7b40f18af3fa600921a8b042e91f40697ae9a5edc699c6000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000300000000000000000000000000000000000000000000000000000000000000000000000ae9eea452863204362b299058f8dcd1bb11ffa8201e40690c2785e3da04fd053050100001000000030000000500000005bab4061f196851a12395ceacce569a4c6de29e4bbdc53983027ac2732469871f503fce6c7414a209370d557dad6f4b874b4dc452f417744f1f72b253fab397eb100000000000000ad00000010000000300000008d0000006124b156c43148b87f19f822b722616bfff51da9160e0cf6567c9dc26ba69edf000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000310000000000000000000000000000000000000000000000000000000000000000000000155a3313fae1048bcc54240c97288367dabacfb7e674089bd2740092cee833f305010000100000003000000050000000d5aa126baff9355902f50b6d789aead6fc1b592bdc2b1cbca39c3a2a0875d203f152f1768a93864e456ef13e6776a3e17337a22c1c776f54decca968276058f5b100000000000000ad00000010000000300000008d0000004654224f15da1eabeb598c0a1a38315eaf46f0dd4024c7e49ed8f1dc3c339d60000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000032000000000000000000000000000000000000000000000000000000000000000000000094a2d1a2b1e9f9254ccf41772362a57536cba5376e465deb50a0ca36b034be6005010000100000003000000050000000d6da28002a07419a52220a1575ce83c498d85444495a830c63932975b5b9456fc55ee177f54e701617f129285ffab03105020e6520e8bfc972b66d1fba280935b100000000000000ad00000010000000300000008d0000005ef9a990b8f8a4ad7994e8da7dedf0f731822d16af61ca2ab2baa9f93c5fd39e000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000330000000000000000000000000000000000000000000000000000000000000000000000cee5a85c2720dc9b05ea6685a8e6445e44cdb2468ac9d11ca74eb697560150a40501000010000000300000005000000007bcd31bfff2b6cffa5562e43f8b2ec00c2949ea6bfaef94909df1ede70c67a7e812b571d402c4564ebc31ec29068766d61293e20aee37c0de366d28361664e0b100000000000000ad00000010000000300000008d000000d3f713acce23ecdf9cb3df26dda05de60d9efde2fe48f8795925b57c8719f313000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000034000000000000000000000000000000000000000000000000000000000000000000000031e7d5355d400675037052d654d4b7c823e7a5a0f877c2a4e3de66953bd66d2a05010000100000003000000050000000a605ef52a15b19224ffbdd285948d92754e1fb90806648884d44835b8f0eb913f3bedac9a0eaecf0fa6fbd08cc683a518aa098bf06b7353a1c45d2a19c03e1d4b100000000000000ad00000010000000300000008d0000000fcded3348ee804cd77d9df8af8a5d522df005c757246a7c0683aafd56ebfefa000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000350000000000000000000000000000000000000000000000000000000000000000000000e63af4ce1761269f884be2961ecb482247f60e63a90c0fa0603f5509bfda604205010000100000003000000050000000ebcad25471c1a16880a0e63687fdb8d3d24e95d5fdfd0e46bbaa79284c4f1434e8bf678a23770935b33006a5d3313031228be6975b902c365520749bd199164eb100000000000000ad00000010000000300000008d0000007295e85d372296408b5a881034ee4044ccb732d10972bc724b81394ca0826bdb000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000360000000000000000000000000000000000000000000000000000000000000000000000120765ebab9187f694a28f2f3c02f45e9aa574764af5f29a09f4a51099c0df2205010000100000003000000050000000a4a285445dff1ae314cf8f6189707936a66690015288436adf6c70f96c584ec5446d9e6b70e9aa6def10a902867f59d37d01658502ac4465962bcbc1aa14f5e4b100000000000000ad00000010000000300000008d00000087b8a3cc255d8927ccfb5d7a5c1519981c13401bb62dc21b7d4a8e57f05b1946000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000003700000000000000000000000000000000000000000000000000000000000000000000007c74f48b5214f9c56c06ee28b4664ee5f129c78d0e3114b2bb1538650ae1c8cd0501000010000000300000005000000034d7c8bf91422db1f1a951c071736cce9108c15f9825dc525b86e2a9a29dce206c62938d5088531e4fb77108f7a2d363ec0a30d1a75b922f31c36b99e25a3ae1b100000000000000ad00000010000000300000008d000000fe45e218f75630816a4debba5fd31abb4926c3c247bce9d662088618f8861b1f000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000038000000000000000000000000000000000000000000000000000000000000000000000082c93af52af4843308e22da0d1d53146563cf06393ad4b9cf8b7dbfd28edff5205010000100000003000000050000000ac46efbf518f621168059ce07aae0a4b23bc3d37289bb2a9555430a7b789897c95c95dfc0dd92092f6779f79552478aa593ab0c3005c93402859a8ec96ef3ed0b100000000000000ad00000010000000300000008d000000897b37f01ce77834871ea9a16aac18a7e84d432ef606652233970458d6069110000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248012400000039000000000000000000000000000000000000000000000000000000000000000000000053bc4c10a916b93d209b046a53df98d1b0495128fa42f3945a174544c112748505010000100000003000000050000000c2dd36cd6ffcebf9cb7fdccdce1cc1eacf3a2d254b41b0301bc4eac69cc72092420d6ee3852c4fac2b2f5d4f2ef855922f18afc6a322540aec1642a2c7c46a7fb100000000000000ad00000010000000300000008d000000931d06a94be49a979248b249e846231eea7612916d29933b1d68fcabffef352e000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000003a00000000000000000000000000000000000000000000000000000000000000000000003e19f4f5853b1a21a64b7d9f84ab978addb31777b6e438cf064f4a107197de50050100001000000030000000500000004a8c73d5c7d6d5529c50e5915da68f74e054e4dfecee57c289ef28656df24ecba4504b721fd1e917bcce262aa049c168f5bc86f325a8b845329f100e41efd81eb100000000000000ad00000010000000300000008d0000008468b510cacbef7765e5528e19672472d085fde264577a6b3dfb999ca3cdfc48000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000003b00000000000000000000000000000000000000000000000000000000000000000000007f827801f9e565c05e37adfc4c8245721c55aa93f75c645003a30cbdb4bd879405010000100000003000000050000000d7a3a4a379a2d3ed45facdb63fd85ada35817f0125d1b4f2accaa982635cfb8fb9aa020ba29b7712c853c2405590f4d9d9fb9f5cf8b1d55481c65fc5fcc884a0b100000000000000ad00000010000000300000008d000000ad8bedca2680020b5873395b1caa32993230bbfd4ac153e59c1722fa49328731000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000003c0000000000000000000000000000000000000000000000000000000000000000000000fce2718391cf51b385aa7e804f816033c3aeb78157fe7bdb78671979420d643c050100001000000030000000500000001bbbb20eab1a1be5ae1e2e40709a4b5d7532bea416991e83dbe77f25bb4b95b9f9d699242fbde07eb5ffce6227432e9d89079d77a3fb8249362f8fadf3ec02bab100000000000000ad00000010000000300000008d000000bd4d0f1a43b1b46bfaeb9dee2f813cde45951c3de704ae41db750bd5a0ea57a5000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000003d000000000000000000000000000000000000000000000000000000000000000000000058c3d1a6cea8c3a7ac91badb2d3bb36a348bd0f09c2ce9f69a837438a1b5897505010000100000003000000050000000decfa4d65ee8f0e3c2bf8051fc8f5de0294488ef9e74b4f4e6383746035c1e5e472e98c9085000b3625bde940efe367508847354295f7e9577c444606a1a81d2b100000000000000ad00000010000000300000008d0000009122a67b32c9003e462c1a3442c7da0f036e2a4fe386db881d637483fdfd10ae000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000003e00000000000000000000000000000000000000000000000000000000000000000000000ee603e222c75c0ebf20018a6c6cc355793d4293dea9792de48bafa7db352a66050100001000000030000000500000002ce1c9054b4b7c4093d577f2df157a85e4e8e4a4fd5ab53d3822c85d70eecf0b3d81b68e676c75b31133b1b50144427ed15b17446335ab98c85221f9ac09ef44b100000000000000ad00000010000000300000008d0000009a85cf8af7310f096f3e4d7a1021e8067e22fdba8fdd55bc9d853c021dcacedf000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000003f0000000000000000000000000000000000000000000000000000000000000000000000e57249f520f9127ce007f9105b63764eb54abb5063611bb40511a199b96b2f5c05010000100000003000000050000000ada9e3e37b9e47c70e46198ec031f3f4067942c420323ae3df5eac201672a96ea216d84bbbf8482359ab77affa731e1c942ab4def3b62707f3d72382b06446bdb100000000000000ad00000010000000300000008d000000f5f07e6ca069ed871040c4356fa64b8c29bffad26b1d4d9e113c4202632ed217000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000004000000000000000000000000000000000000000000000000000000000000000000000008bef99a4149ac593bfdf6ab9f6ffd689925d647f80a9676a5d6f2784bb841185050100001000000030000000500000007004f0d11d587fc7f85147290c53396bc0cbe80ca50231117716f80914dc799f2ec44ed293262c5ede6619dfe1d36d59d8dcac25ccf38cf118bf784fc73df576b100000000000000ad00000010000000300000008d000000e7e3e11ef5a34159dbb35bf50cdf5601649101c6916190fe5b7f52e4ca0e0126000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000410000000000000000000000000000000000000000000000000000000000000000000000d51c0f1ed9a8a202bb5e5f7f8900bf57d9bb4b50581f5a963da2b4f1c3add1f70501000010000000300000005000000041d883b0f8a4b622b7cbfa09d25ab75521468489d1206ba0cd60a8103f4c2912d78be3b4da9faf7859c2344046b7d93317089462e5f3ef4b591be360b9f97d91b100000000000000ad00000010000000300000008d000000b3c6ef545d63927750072d76a850ba839e7e2ac6cf2685fa96d972cb69117521000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000420000000000000000000000000000000000000000000000000000000000000000000000d59c9018ee35475a0d0f0ad845148782e8942b6ab30e8baa9f5e1242d82b4f420501000010000000300000005000000038eefcc00addddeb9892159e862dccea80c0cb36c4b2f19e49489852e19e1d225d92de183dd16c63cd5bb1ed782534b1ceb13ce70333ae9cbeeb151da59cbdaab100000000000000ad00000010000000300000008d0000009323d83862319db9b0a28749685637be8a0364ac558298b69c6aa6e55a1db659000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000004300000000000000000000000000000000000000000000000000000000000000000000001848400d3e46862def499d4aab0ceaac4fe7b49fe844303f4ea414dee141b07e05010000100000003000000050000000a550427957a4ba8d6554feffc148b29aea3f7d7b06db4c4a9841d2d47024dc49a4e1d1ff63c3a28e7cae3842903b67c858d2341561d2c4c18d4b82ba712be755b100000000000000ad00000010000000300000008d00000033998afe1e0f33f108c9c80dc5389162386621696ad29db8f04b4c505be974b8000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000440000000000000000000000000000000000000000000000000000000000000000000000457e3199a31db3b57036f021b64728d5f76d1c04692d3e04f428858cb843967505010000100000003000000050000000daea8a33549b0b6231eabb2150b1312243f08ffb509d0f5e4215460206ae4865538e2d698ee9dbfe10980fd820719f88276a6427d37eef5ef1bda80c93da56c8b100000000000000ad00000010000000300000008d000000ecbc9f3af87f69fee8384624bf2f7fb5ee27043270ad47b68116493e72ea7028000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000004500000000000000000000000000000000000000000000000000000000000000000000000c5105ebf52b0c3f647784a92e837d57343149b7923f019789894864a808e7d50501000010000000300000005000000072192185c3f859c82328f65d29b4877bcfdab209c8adc459f948860500431f8c1203fd53114f032b2183edeb909fb43358419850c4eb40a7903ba411d28dcbc7b100000000000000ad00000010000000300000008d0000009949d51c1907d4f66668df91cd5c4a935f1908ad76e1986d9b83b73eab3341a3000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c324801240000004600000000000000000000000000000000000000000000000000000000000000000000002470e728d4e948b394c7e14b632ff6683a64a99c570abd05a5e36b1ecf537e44050100001000000030000000500000002645ceb110e58d7a13927141f47555a9cb396efb97939778d51f5c8100945936e03c036a4e01182044495f10768094f6a966a61ca289a20f99b2fb96261d208fb100000000000000ad00000010000000300000008d000000921f489e20b342ff6c948e2623066eaafc253a5d1e85e5a138957e0de4a86557000000005900000010000000300000003100000061ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c32480124000000470000000000000000000000000000000000000000000000000000000000000000000000e58709bbff55e86e44dc3234ee787aee1eb2224e34d78e2e6ffd99ada869dbb2"
    ]
  } */

  const interval = setInterval(async () => {
    try {
      console.log('Waiting for BTC tx and proof to be ready');
      const rgbppApiSpvProof = await btcService.getRgbppSpvProof(btcTxId, 0);
      clearInterval(interval);
      // Update CKB transaction with the real BTC txId
      const newCkbRawTx = updateCkbTxWithRealBtcTxId({ ckbRawTx, btcTxId, isMainnet });
      console.log('The new cluster rgbpp lock args: ', newCkbRawTx.outputs[0].lock.args);
      console.log('The new cluster rgbpp lock args -- btc tx id: ', btcTxId);
      console.log('The new cluster rgbpp lock args -- btc tx out index: 1');

      const ckbTx = await appendCkbTxWitnesses({
        ckbRawTx: newCkbRawTx,
        btcTxBytes,
        rgbppApiSpvProof,
      });

      // The outputs[1..] are spore cells from which you can find spore type scripts,
      // and the spore type scripts will be used to transfer and leap spores
      console.log('Spore type scripts: ', JSON.stringify(ckbTx.outputs.slice(1).map((output) => output.type)));

      // Replace cobuild witness with the final rgbpp lock script
      ckbTx.witnesses[ckbTx.witnesses.length - 1] = generateSporeCreateCoBuild({
        // The first output is cluster cell and the rest of the outputs are spore cells
        sporeOutputs: ckbTx.outputs.slice(1),
        sporeOutputsData: ckbTx.outputsData.slice(1),
        clusterCell,
        clusterOutputCell: ckbTx.outputs[0],
      });

      // console.log('ckbTx: ', JSON.stringify(ckbTx));

      const signedTx = await appendIssuerCellToSporesCreate({
        secp256k1PrivateKey: CKB_PRIVATE_KEY,
        issuerAddress: ckbAddress,
        ckbRawTx: ckbTx,
        collector,
        sumInputsCapacity,
        isMainnet,
      });

      const txHash = await sendCkbTx({ collector, signedTx });
      console.info(`RGB++ Spore has been created and tx hash is ${txHash}`);
    } catch (error) {
      if (!(error instanceof BtcAssetsApiError)) {
        console.error(error);
      }
    }
  }, 30 * 1000);
};

// Please use your real BTC UTXO information on the BTC Testnet
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet

const clusterId = '0xd808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf';

// rgbppLockArgs: outIndexU32 + btcTxId
createSpores({
  // The cluster cell will be spent and the new cluster cell will be created in each spore creation tx,
  // so the cluster rgbpp lock args should be updated after each spore creation tx is completed.
  // The first cluster rgbpp lock args is from 2-create-cluster.ts and the new cluster rgbpp lock args can be found from the log in the line 71 of this file
  clusterRgbppLockArgs: buildRgbppLockArgs(1, '0e12eabccfe356ecf57bc311e6ad4651f4d4dbaeee259dc47eb928dec764b62b'),
  receivers: Array(70)
    .fill(null)
    .map(() => ({
      toBtcAddress: 'tb1qx00uz6cgxvxgr3k7gs93enh6j8vrljqwu7nv2f',
      sporeData: {
        contentType: 'dob/0',
        content: ccc.bytesFrom(`{ "dna": "${generateSimpleDNA(16)}" }`, 'utf8'),
        clusterId,
      },
    })),
});

/* 
create spore (6th batch):
- [BTC tx](https://mempool.space/testnet/tx/8ea50629ca364377f4474af7dcdfb5dac8e139962c80ea0555dc416202a8ca29)
- [CKB tx](https://testnet.explorer.nervos.org/transaction/0xacd413e4d8f0b31224fe3aa49b9838929d823e1b8f2e2ce7b3c9bfb20428e342)
*/
