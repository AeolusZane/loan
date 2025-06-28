// 合约地址配置
export const CONTRACT_ADDRESSES = {
  // 这些地址需要在部署后更新
  COLLATERAL_VAULT: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // 部署后填入实际地址
  MOCK_USDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // 部署后填入实际地址
};

// 网络配置
export const NETWORKS = {
  localhost: {
    chainId: 31337,
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
  },
};

// 系统参数
export const SYSTEM_PARAMS = {
  MIN_COLLATERAL_RATIO: 150, // 150%
  LIQUIDATION_THRESHOLD: 125, // 125%
  LIQUIDATION_PENALTY: 10, // 10%
  ETH_PRICE: 2000, // 初始ETH价格（USDC）
}; 