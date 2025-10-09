---
'@rgbpp-sdk/ckb': patch
---

fix: ensure sufficient capacity when deducting tx fee from last output

Fix capacity validation when deducting transaction fees from the last output to prevent insufficient capacity errors.