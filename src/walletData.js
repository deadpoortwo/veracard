// Missing/unqueried balances stay null. Never substitute an invented zero or USD value.
export function walletBalanceData(chain, network) {
  const assets = chain.status === "ready" ? chain.assets : [];
  const usdt = assets.find((asset) => asset.symbol === "USDT")?.balance ?? null;
  return {
    assets,
    balance: usdt,
    usdBalance: chain.usdBalance ?? null,
    balanceStatus: chain.status,
    balanceMessage: chain.message,
    networkBalances: { [network]: { usdt } },
  };
}
