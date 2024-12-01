import { RgbppTransferAllTxsParams } from '../rgbpp/types/xudt';

export interface TransferAllTxsParams {
  ckb: Omit<RgbppTransferAllTxsParams['ckb'], 'collector'>;
  btc: Omit<RgbppTransferAllTxsParams['btc'], 'dataSource' | 'testnetType'>;
  isMainnet: boolean;
}
