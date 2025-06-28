const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署抵押系统合约...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // 部署MockUSDC合约
  console.log("\n部署MockUSDC合约...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("MockUSDC合约地址:", mockUSDCAddress);

  // 设置初始ETH价格（以USDC计价，例如1 ETH = 2000 USDC）
  const initialEthPrice = ethers.parseUnits("2000", 6); // 2000 USDC per ETH

  // 部署CollateralVault合约
  console.log("\n部署CollateralVault合约...");
  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const collateralVault = await CollateralVault.deploy(mockUSDCAddress, initialEthPrice);
  await collateralVault.waitForDeployment();
  const collateralVaultAddress = await collateralVault.getAddress();
  console.log("CollateralVault合约地址:", collateralVaultAddress);

  // 为抵押金库铸造一些USDC作为初始流动性
  console.log("\n为抵押金库添加初始流动性...");
  const initialLiquidity = ethers.parseUnits("1000000", 6); // 1,000,000 USDC
  await mockUSDC.mint(collateralVaultAddress, initialLiquidity);
  console.log("已添加", ethers.formatUnits(initialLiquidity, 6), "USDC作为初始流动性");

  // 为部署者铸造一些USDC用于测试
  const testAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
  await mockUSDC.mint(deployer.address, testAmount);
  console.log("已为部署者铸造", ethers.formatUnits(testAmount, 6), "USDC用于测试");

  console.log("\n部署完成！");
  console.log("=== 合约地址 ===");
  console.log("MockUSDC:", mockUSDCAddress);
  console.log("CollateralVault:", collateralVaultAddress);
  console.log("=== 系统参数 ===");
  console.log("初始ETH价格:", ethers.formatUnits(initialEthPrice, 6), "USDC");
  console.log("最小抵押率: 150%");
  console.log("清算阈值: 125%");
  console.log("清算惩罚: 10%");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 