import { formatUnits } from "ethers";

export function normalizeDynamicBalances(tokens, networkId) {
  if (!Array.isArray(tokens)) throw new Error("Invalid Dynamic balance response");
  const assets = tokens
    .filter((t) => t.networkId === undefined || t.networkId === networkId)
    .map((t) => ({
      symbol: t.symbol,
      address: t.address,
      name: t.name,
      decimals: t.decimals,
      logoURI: t.logoURI,
      balance:
        typeof t.rawBalanceString === "string"
          ? formatUnits(BigInt(t.rawBalanceString), t.decimals)
          : String(t.balance),
      marketValue: typeof t.marketValue === "number" && Number.isFinite(t.marketValue) ? t.marketValue : null,
    }));
  return {
    status: "ready",
    source: "dynamic",
    assets,
    usdBalance: assets.every((a) => a.marketValue !== null)
      ? assets.reduce((sum, a) => sum + a.marketValue, 0)
      : null,
  };
}

export async function fetchDynamicBalances({ environmentId, address, networkId, token }) {
  const url = new URL(`https://app.dynamicauth.com/api/v0/sdk/${environmentId}/chains/EVM/balances`);
  url.search = new URLSearchParams({
    accountAddress: address,
    networkId: String(networkId),
    includePrices: "true",
    includeNative: "true",
    filterSpamTokens: "true",
    forceRefresh: "true",
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Dynamic balances unavailable");
  return normalizeDynamicBalances(await response.json(), networkId);
}
