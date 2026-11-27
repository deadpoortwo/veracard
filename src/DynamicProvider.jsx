import React, { useLayoutEffect, useRef } from "react";
import {
  DynamicContextProvider,
  useDynamicContext,
  useConnectWithOtp,
  useDynamicWaas,
  useEmbeddedWallet,
  useWalletPassword,
  useRefreshAuth,
  getAuthToken,
  DynamicEmbeddedWidget,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { TronWalletConnectors } from "@dynamic-labs/tron";
import { setDynamicBridge } from "./dynamicRuntime.js";

function Bridge({ children }) {
  const context = useDynamicContext();
  const otp = useConnectWithOtp();
  const waas = useDynamicWaas();
  const embedded = useEmbeddedWallet();
  const passwords = useWalletPassword();
  const refreshAuth = useRefreshAuth();
  const state = useRef(null);
  state.current = { context, otp, waas, embedded, passwords, refreshAuth };

  useLayoutEffect(() => {
    setDynamicBridge({
      ready: context.sdkHasLoaded,
      token: getAuthToken,
      snapshot: () => state.current,
      send: (email) => state.current.otp.connectWithEmail(email),
      verify: (code) => state.current.otp.verifyOneTimePassword(code),
      resend: () => state.current.otp.retryOneTimePassword(),
      logout: () => state.current.context.handleLogOut(),
    });
    return () => setDynamicBridge(null);
  }, [context.sdkHasLoaded]);

  return children;
}

export function DynamicWalletWidget() {
  return <DynamicEmbeddedWidget background="default" />;
}

export default function DynamicProvider({ children }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
        walletConnectors: [
          EthereumWalletConnectors,
          SolanaWalletConnectors,
          BitcoinWalletConnectors,
          TronWalletConnectors,
        ],
        appName: "VeraCard",
      }}
      theme="light"
    >
      <Bridge>{children}</Bridge>
    </DynamicContextProvider>
  );
}
