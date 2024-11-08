import {
  RgbppCkbVirtualTx,
  RgbppLaunchPartialCkbTxParams,
  RgbppLaunchCkbVirtualTxParams,
  RgbppLaunchVirtualTxResult,
  RgbppLaunchPartialCkbTxResult,
} from '../types/rgbpp';
import { NoLiveCellError } from '../error';
import {
  append0x,
  calculateRgbppTokenInfoCellCapacity,
  calculateTransactionFee,
  fetchTypeIdCellDeps,
  generateUniqueTypeArgs,
  u128ToLe,
  buildPreLockArgs,
  calculateCommitment,
  encodeRgbppTokenInfo,
  genBtcTimeLockScript,
  genRgbppLockScript,
} from '../utils';
import { Hex } from '../types';
import {
  MAX_FEE,
  RGBPP_TX_WITNESS_MAX_SIZE,
  RGBPP_WITNESS_PLACEHOLDER,
  getXudtTypeScript,
  getUniqueTypeScript,
  UNLOCKABLE_LOCK_SCRIPT,
} from '../constants';
import { getTransactionSize, scriptToHash } from '@nervosnetwork/ckb-sdk-utils';

import { ccc } from '@ckb-ccc/core';

export const genPartialRgbppCkbTx = async ({
  signer,
  ownerRgbppLockArgs,
  launchAmount,
  rgbppTokenInfo,
  ckbFeeRate,
  isMainnet,
  btcTestnetType,
}: RgbppLaunchPartialCkbTxParams): Promise<RgbppLaunchPartialCkbTxResult> => {
  const rgbppAssetOwnerLock = genRgbppLockScript(ownerRgbppLockArgs, isMainnet, btcTestnetType);
  console.log('rgbppAssetOwnerLock', rgbppAssetOwnerLock);

  const ckbClient = signer.client;
  const rgbppLaunchCells: ccc.Cell[] = [];
  for await (const cell of ckbClient.findCells({
    script: rgbppAssetOwnerLock,
    scriptType: 'lock',
    scriptSearchMode: 'exact',
    filter: {
      scriptLenRange: [0, 1],
      outputDataLenRange: [0, 1],
    },
  })) {
    rgbppLaunchCells.push(cell);
  }

  if (rgbppLaunchCells.length === 0) {
    throw new NoLiveCellError('The owner address has no certain live cells available');
  }
  console.log(`${rgbppLaunchCells.length} cells found\n`, rgbppLaunchCells);
  const inputs = rgbppLaunchCells.map(({ outPoint, cellOutput, outputData }) => ({
    previousOutput: outPoint,
    cellOutput,
    outputData: outputData,
  }));

  const tx = ccc.Transaction.from({ inputs });
  const inputCapacity = tx.inputs.reduce((sum, input) => sum + input.cellOutput!.capacity, BigInt(0));
  console.log(`gatheredCapacity: ${inputCapacity}, input count: ${tx.inputs.length}`);

  const infoCellCapacity = calculateRgbppTokenInfoCellCapacity(rgbppTokenInfo, isMainnet);
  tx.addOutput({
    lock: genRgbppLockScript(buildPreLockArgs(1), isMainnet, btcTestnetType),
    type: {
      ...getXudtTypeScript(isMainnet),
      args: append0x(scriptToHash(rgbppAssetOwnerLock)),
    },
    capacity: BigInt(inputCapacity) - infoCellCapacity,
  });
  tx.setOutputDataAt(0, append0x(u128ToLe(launchAmount)));
  tx.addOutput({
    lock: genBtcTimeLockScript(UNLOCKABLE_LOCK_SCRIPT, isMainnet, btcTestnetType),
    type: {
      ...getUniqueTypeScript(isMainnet),
      // ! TODO: TMP WORKAROUND, FIXME
      // ! hardcoded: use inputs[0] to generate TypeID args
      args: generateUniqueTypeArgs(
        {
          previousOutput: {
            txHash: tx.inputs[0].previousOutput.txHash,
            index: `0x${tx.inputs[0].previousOutput.index.toString(16)}`,
          },
          since: `0x${tx.inputs[0].since.toString(16)}`,
        },
        1,
      ),
    },
    capacity: infoCellCapacity,
  });
  tx.setOutputDataAt(1, encodeRgbppTokenInfo(rgbppTokenInfo));
  tx.addCellDeps(
    (await fetchTypeIdCellDeps(isMainnet, { rgbpp: true, xudt: true, unique: true }, btcTestnetType)).map((dep) => {
      if (dep.outPoint === null || dep.outPoint === undefined) {
        throw new Error('dep.outPoint is required');
      }
      return {
        outPoint: dep.outPoint,
        depType: dep.depType,
      };
    }),
  );

  tx.witnesses = Array(tx.inputs.length).fill('0x');
  tx.witnesses[0] = RGBPP_WITNESS_PLACEHOLDER;

  await tx.completeFeeBy(signer, ckbFeeRate);

  // ! TODO: TMP WORKAROUND, FIXME
  const commitment = calculateCommitment({
    inputs: tx.inputs.map((input) => ({
      ...input,
      previousOutput: {
        ...input.previousOutput,
        index: `0x${input.previousOutput.index.toString(16)}`,
      },
      since: `0x${input.since.toString(16)}`,
    })),
    outputs: tx.outputs.map((output) => ({
      ...output,
      capacity: append0x(output.capacity.toString(16)),
    })),
    outputsData: tx.outputsData,
  });

  return {
    partialCkbTx: tx,
    commitment,
    needPaymasterCell: false,
  };
};

/**
 * Generate the virtual ckb transaction for the btc transfer tx
 * @param collector The collector that collects CKB live cells and transactions
 * @param ownerRgbppLockArgs The owner RGBPP lock args whose data structure is: out_index | bitcoin_tx_id
 * @param launchAmount The total amount of RGBPP assets issued
 * @param rgbppTokenInfo The RGBPP token info https://github.com/ckb-cell/unique-cell?tab=readme-ov-file#xudt-information
 * @param isMainnet True is for BTC and CKB Mainnet, false is for BTC and CKB Testnet(see btcTestnetType for details about BTC Testnet)
 * @param witnessLockPlaceholderSize(Optional) The WitnessArgs.lock placeholder bytes array size and the default value is 5000
 * @param ckbFeeRate(Optional) The CKB transaction fee rate, default value is 1100
 * @param btcTestnetType(Optional) The Bitcoin Testnet type including Testnet3 and Signet, default value is Testnet3
 */
export const genRgbppLaunchCkbVirtualTx = async ({
  collector,
  ownerRgbppLockArgs,
  launchAmount,
  rgbppTokenInfo,
  witnessLockPlaceholderSize,
  ckbFeeRate,
  isMainnet,
  btcTestnetType,
}: RgbppLaunchCkbVirtualTxParams): Promise<RgbppLaunchVirtualTxResult> => {
  const ownerLock = genRgbppLockScript(ownerRgbppLockArgs, isMainnet, btcTestnetType);
  let emptyCells = await collector.getCells({ lock: ownerLock });
  if (!emptyCells || emptyCells.length === 0) {
    throw new NoLiveCellError('The owner address has no empty cells');
  }
  emptyCells = emptyCells.filter((cell) => !cell.output.type);
  const infoCellCapacity = calculateRgbppTokenInfoCellCapacity(rgbppTokenInfo, isMainnet);

  const txFee = MAX_FEE;
  const { inputs, sumInputsCapacity } = collector.collectInputs(emptyCells, infoCellCapacity, txFee);

  let rgbppCellCapacity = sumInputsCapacity - infoCellCapacity;
  const outputs: CKBComponents.CellOutput[] = [
    {
      lock: genRgbppLockScript(buildPreLockArgs(1), isMainnet, btcTestnetType),
      type: {
        ...getXudtTypeScript(isMainnet),
        args: append0x(scriptToHash(ownerLock)),
      },
      capacity: append0x(rgbppCellCapacity.toString(16)),
    },
    {
      lock: genBtcTimeLockScript(UNLOCKABLE_LOCK_SCRIPT, isMainnet, btcTestnetType),
      type: {
        ...getUniqueTypeScript(isMainnet),
        args: generateUniqueTypeArgs(inputs[0], 1),
      },
      capacity: append0x(infoCellCapacity.toString(16)),
    },
  ];

  const outputsData = [append0x(u128ToLe(launchAmount)), encodeRgbppTokenInfo(rgbppTokenInfo)];
  const cellDeps = await fetchTypeIdCellDeps(isMainnet, { rgbpp: true, xudt: true, unique: true }, btcTestnetType);

  const witnesses: Hex[] = inputs.map((_, index) => (index === 0 ? RGBPP_WITNESS_PLACEHOLDER : '0x'));

  const ckbRawTx: CKBComponents.RawTransaction = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData,
    witnesses,
  };

  const txSize = getTransactionSize(ckbRawTx) + (witnessLockPlaceholderSize ?? RGBPP_TX_WITNESS_MAX_SIZE);
  const estimatedTxFee = calculateTransactionFee(txSize, ckbFeeRate);
  rgbppCellCapacity -= estimatedTxFee;
  ckbRawTx.outputs[0].capacity = append0x(rgbppCellCapacity.toString(16));

  const virtualTx: RgbppCkbVirtualTx = {
    ...ckbRawTx,
    outputs: ckbRawTx.outputs,
  };

  const commitment = calculateCommitment(virtualTx);

  return {
    ckbRawTx,
    commitment,
    needPaymasterCell: false,
  };
};
