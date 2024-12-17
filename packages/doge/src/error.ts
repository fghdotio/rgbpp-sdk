import { TxBuilder } from './transaction/build';

export enum ErrorCodes {
  UNKNOWN,

  MISSING_PUBKEY = 20,
  CANNOT_FIND_UTXO,
  UNCONFIRMED_UTXO,
  INSUFFICIENT_UTXO,
  REFERENCED_UNPROVABLE_UTXO,
  UNSPENDABLE_OUTPUT,
  DUPLICATED_UTXO,
  DUST_OUTPUT,
  UNSUPPORTED_OUTPUT,
  INVALID_CHANGE_OUTPUT,
  UNSUPPORTED_NETWORK_TYPE,
  UNSUPPORTED_ADDRESS_TYPE,
  UNSUPPORTED_OP_RETURN_SCRIPT,
  INVALID_FEE_RATE,
  PAYMASTER_MISMATCH,
  INVALID_UTXO_ID,

  CKB_CANNOT_FIND_OUTPOINT = 40,
  CKB_INVALID_CELL_LOCK,
  CKB_INVALID_INPUTS,
  CKB_INVALID_OUTPUTS,
  CKB_UNMATCHED_COMMITMENT,

  MEMPOOL_API_RESPONSE_ERROR = 60,
}

export const ErrorMessages = {
  [ErrorCodes.UNKNOWN]: 'Unknown error',

  [ErrorCodes.MISSING_PUBKEY]:
    'Missing a pubkey that pairs with the address, it is required for the P2TR UTXO included in the transaction',
  [ErrorCodes.CANNOT_FIND_UTXO]: 'Cannot find the UTXO, it may not exist or is not live',
  [ErrorCodes.UNCONFIRMED_UTXO]: 'Unconfirmed UTXO',
  [ErrorCodes.INSUFFICIENT_UTXO]: 'Insufficient UTXO to construct the transaction',
  [ErrorCodes.REFERENCED_UNPROVABLE_UTXO]: 'Cannot reference a UTXO that does not belongs to "from"',
  [ErrorCodes.DUPLICATED_UTXO]: 'Cannot reference the same UTXO twice',
  [ErrorCodes.UNSPENDABLE_OUTPUT]: 'Target output is not an UTXO',
  [ErrorCodes.DUST_OUTPUT]: 'Output defined value is below the dust limit',
  [ErrorCodes.UNSUPPORTED_OUTPUT]: 'Unsupported output format',
  [ErrorCodes.INVALID_CHANGE_OUTPUT]: 'Invalid change output',
  [ErrorCodes.UNSUPPORTED_NETWORK_TYPE]: 'Unsupported network type',
  [ErrorCodes.UNSUPPORTED_ADDRESS_TYPE]: 'Unsupported address type',
  [ErrorCodes.UNSUPPORTED_OP_RETURN_SCRIPT]: 'Unsupported OP_RETURN script format',
  [ErrorCodes.INVALID_FEE_RATE]: 'Invalid fee rate provided or recommended',
  [ErrorCodes.PAYMASTER_MISMATCH]: 'Paymaster mismatched',
  [ErrorCodes.INVALID_UTXO_ID]: 'Invalid UtxoId',

  [ErrorCodes.CKB_CANNOT_FIND_OUTPOINT]: 'Cannot find CKB cell by OutPoint, it may not exist or is not live',
  [ErrorCodes.CKB_INVALID_CELL_LOCK]: 'Invalid CKB cell lock, it should be RgbppLock, RgbppTimeLock or null',
  [ErrorCodes.CKB_INVALID_INPUTS]: 'Invalid input(s) found in the CKB VirtualTx',
  [ErrorCodes.CKB_INVALID_OUTPUTS]: 'Invalid output(s) found in the CKB VirtualTx',
  [ErrorCodes.CKB_UNMATCHED_COMMITMENT]: 'Invalid commitment found in the CKB VirtualTx',

  [ErrorCodes.MEMPOOL_API_RESPONSE_ERROR]: 'Mempool.space API returned an error',
};

export interface TxBuildErrorContext {
  tx?: TxBuilder;
}

export class TxBuildError extends Error {
  public code = ErrorCodes.UNKNOWN;
  public context?: TxBuildErrorContext;

  constructor(code: ErrorCodes, message = ErrorMessages[code] || 'Unknown error', context?: TxBuildErrorContext) {
    super(message);
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, TxBuildError.prototype);
  }

  static withComment(code: ErrorCodes, comment?: string, context?: TxBuildErrorContext): TxBuildError {
    const message: string | undefined = ErrorMessages[code];
    return new TxBuildError(code, comment ? `${message}: ${comment}` : message, context);
  }

  setContext(context: TxBuildErrorContext) {
    this.context = context;
  }
}
