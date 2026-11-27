import test from "node:test";
import assert from "node:assert/strict";
import { walletBalanceData } from "../src/walletData.js";

test("unknown assets and unqueried networks never appear as zero balances", () => {
  const eth = walletBalanceData({ status: "ready", assets: [{ symbol: "ETH", balance: "1.234567890123456789" }] }, "Ethereum");
  assert.equal(eth.balance, null);
  assert.equal(eth.networkBalances.Ethereum.usdt, null);
  assert.equal(eth.networkBalances["BNB Chain"], undefined);
  assert.equal(eth.usdBalance, null);
  assert.equal(eth.assets[0].balance, "1.234567890123456789");

  const failed = walletBalanceData({ status: "unavailable", assets: [], message: "RPC unavailable" }, "BNB Chain");
  assert.equal(failed.balance, null);
  assert.deepEqual(failed.assets, []);

  const zero = walletBalanceData({ status: "ready", assets: [{ symbol: "USDT", balance: "0.0" }] }, "BNB Chain");
  assert.equal(zero.balance, "0.0");
});
