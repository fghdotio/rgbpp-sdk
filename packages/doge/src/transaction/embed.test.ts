// https://opreturn.net/dogecoin/dogewall/

import { describe, it, expect } from 'vitest';
import { isOpReturnScriptPubkey } from './embed';

describe('embed', () => {
  it('isOpReturnScriptPubkey', () => {
    const scriptPubKey = '6a0b4861696c20536174616e21';
    const scriptBuffer = Buffer.from(scriptPubKey, 'hex');

    expect(isOpReturnScriptPubkey(scriptBuffer)).toBe(true);
  });
});

/* 
pnpm vitest run packages/doge/src/transaction/embed.test.ts "isOpReturnScriptPubkey"
*/
