import React from 'react';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { mainnet, sepolia, hardhat } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultWallets, connectorsForWallets } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import CollateralVault from './components/CollateralVault';
import './App.css';

// 配置链和提供者
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet, sepolia, hardhat],
  [publicProvider()]
);

// 配置钱包连接器
const { connectors } = getDefaultWallets({
  appName: 'ETH抵押借贷系统',
  projectId: 'YOUR_PROJECT_ID', // 需要从WalletConnect获取
  chains,
});

// 创建Wagmi配置
const config = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
});

// 创建QueryClient
const queryClient = new QueryClient();

function App() {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={chains}>
          <div className="min-h-screen bg-gray-50">
            <CollateralVault />
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default App;
