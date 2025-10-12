import { RgbppCkbVirtualTx, BtcJumpCkbVirtualTxParams, BtcJumpCkbVirtualTxResult } from '../types/rgbpp';
import { TypeAssetNotSupportedError } from '../error';
import {
  append0x,
  calculateRgbppCellCapacity,
  deduplicateList,
  fetchTypeIdCellDeps,
  isLockArgsSizeExceeded,
  isScriptEqual,
  isUDTTypeSupported,
  u128ToLe,
  buildPreLockArgs,
  calculateCommitment,
  throwErrorWhenTxInputsExceeded,
  compareInputs,
  estimateWitnessSize,
  genBtcTimeLockScript,
  genRgbppLockScript,
  throwErrorWhenRgbppCellsInvalid,
  isRgbppCapacitySufficientForChange,
  isStandardUDTTypeSupported,
  isOfflineMode,
  adjustVirtualTxForTxFee,
  calculateCellOccupiedCapacity,
} from '../utils';
import { Hex, IndexerCell } from '../types';
import { RGBPP_WITNESS_PLACEHOLDER, getSecp256k1CellDep } from '../constants';
import { blockchain } from '@ckb-lumos/base';
import { addressToScript } from '@nervosnetwork/ckb-sdk-utils';

/**
 * Generate the virtual ckb transaction for the jumping tx from BTC to CKB
 * @param collector The collector that collects CKB live cells and transactions
 * @param xudtTypeBytes The serialized hex string of the XUDT type script
 * @param rgbppLockArgsList The rgbpp assets cell lock script args array whose data structure is: out_index | bitcoin_tx_id
 * @param transferAmount The XUDT amount to be transferred
 * @param toCkbAddress The receiver ckb address
 * @param witnessLockPlaceholderSize(Optional) The WitnessArgs.lock placeholder bytes array size and the default value is 5000
 * @param ckbFeeRate(Optional) The CKB transaction fee rate, default value is 1100
 * @param btcTestnetType(Optional) The Bitcoin Testnet type including Testnet3 and Signet, default value is Testnet3
 * @param btcConfirmationBlocks(Optional) The BTC confirmation blocks for BTC Time lock args
 */
export const genBtcJumpCkbVirtualTx = async ({
  collector,
  xudtTypeBytes,
  rgbppLockArgsList,
  transferAmount,
  toCkbAddress,
  witnessLockPlaceholderSize,
  ckbFeeRate,
  btcTestnetType,
  btcConfirmationBlocks,
  vendorCellDeps,
}: BtcJumpCkbVirtualTxParams): Promise<BtcJumpCkbVirtualTxResult> => {
  const isMainnet = toCkbAddress.startsWith('ckb');
  const xudtType = blockchain.Script.unpack(xudtTypeBytes) as CKBComponents.Script;
  const isOffline = isOfflineMode(vendorCellDeps);

  if (!isUDTTypeSupported(xudtType, isMainnet, isOffline)) {
    throw new TypeAssetNotSupportedError('The type script asset is not supported now');
  }

  const deduplicatedLockArgsList = deduplicateList(rgbppLockArgsList);

  const rgbppLocks = deduplicatedLockArgsList.map((args) => genRgbppLockScript(args, isMainnet, btcTestnetType));
  let rgbppTargetCells: IndexerCell[] = [];
  let rgbppOtherTypeCells: IndexerCell[] = [];
  for await (const rgbppLock of rgbppLocks) {
    const cells = await collector.getCells({ lock: rgbppLock, isDataMustBeEmpty: false });

    throwErrorWhenRgbppCellsInvalid(cells, xudtTypeBytes, isMainnet, isOffline);

    const targetCells = cells!.filter((cell) => isScriptEqual(cell.output.type!, xudtTypeBytes));
    const otherTypeCells = cells!.filter((cell) => !isScriptEqual(cell.output.type!, xudtTypeBytes));
    rgbppTargetCells = [...rgbppTargetCells, ...targetCells];
    rgbppOtherTypeCells = [...rgbppOtherTypeCells, ...otherTypeCells];
  }
  rgbppTargetCells = rgbppTargetCells.sort(compareInputs);
  rgbppOtherTypeCells = rgbppOtherTypeCells.sort(compareInputs);

  const {
    inputs,
    sumInputsCapacity: sumUdtCapacity,
    sumAmount,
  } = collector.collectUdtInputs({
    liveCells: rgbppTargetCells,
    needAmount: transferAmount,
  });
  let sumInputsCapacity = sumUdtCapacity;

  throwErrorWhenTxInputsExceeded(inputs.length);

  const rgbppCellCapacity = calculateRgbppCellCapacity(xudtType);

  const toLock = addressToScript(toCkbAddress);
  if (isLockArgsSizeExceeded(toLock.args)) {
    throw new Error('The lock script size of the to ckb address is too large');
  }

  const btcTimeLock = genBtcTimeLockScript(toLock, isMainnet, btcTestnetType, btcConfirmationBlocks);
  const btcTimeLockOutput = {
    lock: btcTimeLock,
    type: xudtType,
    capacity: '0x0',
  };
  const btcTimeLockOutputData = append0x(u128ToLe(transferAmount));
  const minBtcTimeLockOutputCapacity = calculateCellOccupiedCapacity({
    output: btcTimeLockOutput,
    outputData: btcTimeLockOutputData,
  } as IndexerCell);

  let needPaymasterCell = false;
  const needRgbppChange = sumAmount > transferAmount;

  let receiverOutputCapacity: bigint;
  let udtChangeOutput: CKBComponents.CellOutput | null = null;
  let udtChangeOutputData: Hex | null = null;
  if (needRgbppChange) {
    const inputRgbppCellCapacity = BigInt(rgbppTargetCells[0].output.capacity);
    receiverOutputCapacity =
      inputRgbppCellCapacity > minBtcTimeLockOutputCapacity ? inputRgbppCellCapacity : rgbppCellCapacity;

    const isCapacitySufficient = isRgbppCapacitySufficientForChange(sumInputsCapacity, receiverOutputCapacity);
    needPaymasterCell = !isCapacitySufficient;

    // When the capacity of inputs is enough for the outputs, the sender needs to recover the excess capacity.
    const udtChangeCapacity = isCapacitySufficient ? sumInputsCapacity - receiverOutputCapacity : rgbppCellCapacity;
    udtChangeOutput = {
      // The Vouts[0] for OP_RETURN and Vouts[1] for RGBPP assets, BTC time cells don't need btc tx out_index
      lock: genRgbppLockScript(buildPreLockArgs(1), isMainnet, btcTestnetType),
      type: xudtType,
      capacity: append0x(udtChangeCapacity.toString(16)),
    };
    udtChangeOutputData = append0x(u128ToLe(sumAmount - transferAmount));
  } else {
    // To simplify, when the xUDT does not need change, all the capacity of the inputs will be given to the receiver
    receiverOutputCapacity = sumInputsCapacity > minBtcTimeLockOutputCapacity ? sumInputsCapacity : rgbppCellCapacity;

    needPaymasterCell = sumInputsCapacity < receiverOutputCapacity;
  }
  btcTimeLockOutput.capacity = append0x(receiverOutputCapacity.toString(16));

  // The BTC time cell does not need to be bound to the BTC UTXO
  const outputs = [btcTimeLockOutput, udtChangeOutput].filter((o): o is CKBComponents.CellOutput => o !== null);
  const outputsData = [btcTimeLockOutputData, udtChangeOutputData].filter((d): d is Hex => d !== null);

  const targetRgbppOutputLen = outputs.length;
  for (const [index, otherRgbppCell] of rgbppOtherTypeCells.entries()) {
    inputs.push({
      previousOutput: otherRgbppCell.outPoint,
      since: '0x0',
    });
    sumInputsCapacity += BigInt(otherRgbppCell.output.capacity);
    outputs.push({
      ...otherRgbppCell.output,
      // Vouts[targetRgbppOutputLen + 1], ..., Vouts[targetRgbppOutputLen + rgbppOtherTypeCells.length] for other RGBPP assets
      lock: genRgbppLockScript(buildPreLockArgs(targetRgbppOutputLen + index + 1), isMainnet, btcTestnetType),
    });
    outputsData.push(otherRgbppCell.outputData);
  }

  const isStandardUDT = isStandardUDTTypeSupported(xudtType, isMainnet);
  const cellDeps = await fetchTypeIdCellDeps(
    isMainnet,
    {
      rgbpp: true,
      xudt: isStandardUDT,
      compatibleXudtCodeHashes: isStandardUDT ? [] : [xudtType.codeHash],
    },
    btcTestnetType,
    vendorCellDeps,
  );
  if (needPaymasterCell) {
    cellDeps.push(getSecp256k1CellDep(isMainnet));
  }

  const witnesses: Hex[] = [];
  const lockArgsSet: Set<string> = new Set();
  const allRgbppCells = rgbppTargetCells.concat(rgbppOtherTypeCells);
  for (const cell of allRgbppCells) {
    if (lockArgsSet.has(cell.output.lock.args)) {
      witnesses.push('0x');
    } else {
      lockArgsSet.add(cell.output.lock.args);
      witnesses.push(RGBPP_WITNESS_PLACEHOLDER);
    }
  }

  const ckbRawTx: CKBComponents.RawTransaction = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData,
    witnesses,
  };

  if (!needPaymasterCell) {
    const txFeeAdjustedResult = adjustVirtualTxForTxFee(
      ckbRawTx,
      isMainnet,
      witnessLockPlaceholderSize ?? estimateWitnessSize(deduplicatedLockArgsList),
      ckbFeeRate,
    );
    needPaymasterCell = txFeeAdjustedResult.needPaymasterCell;
    ckbRawTx.outputs = txFeeAdjustedResult.outputs;
    ckbRawTx.cellDeps = txFeeAdjustedResult.cellDeps;
  }

  const virtualTx: RgbppCkbVirtualTx = {
    ...ckbRawTx,
  };
  const commitment = calculateCommitment(virtualTx);

  return {
    ckbRawTx,
    commitment,
    needPaymasterCell,
    sumInputsCapacity: append0x(sumInputsCapacity.toString(16)),
  };
};
