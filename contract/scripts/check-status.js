const { ethers } = require("hardhat");

async function main() {
  console.log("检查合约状态...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("检查账户:", deployer.address);

  // 获取合约实例
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");

  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const collateralVault = CollateralVault.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

  // 检查USDC余额
  const deployerUsdcBalance = await mockUSDC.balanceOf(deployer.address);
  const vaultUsdcBalance = await mockUSDC.balanceOf(collateralVault.getAddress());
  
  console.log("\n=== 余额信息 ===");
  console.log("部署者USDC余额:", ethers.formatUnits(deployerUsdcBalance, 6), "USDC");
  console.log("合约USDC余额:", ethers.formatUnits(vaultUsdcBalance, 6), "USDC");

  // 检查用户抵押信息
  const userCollateral = await collateralVault.userCollaterals(deployer.address);
  console.log("\n=== 用户抵押信息 ===");
  console.log("抵押ETH:", ethers.formatEther(userCollateral.ethAmount), "ETH");
  console.log("借贷USDC:", ethers.formatUnits(userCollateral.borrowedAmount, 6), "USDC");

  // 检查系统参数
  const totalCollateral = await collateralVault.totalCollateral();
  const totalBorrowed = await collateralVault.totalBorrowed();
  const ethPrice = await collateralVault.ethPrice();
  
  console.log("\n=== 系统参数 ===");
  console.log("总抵押量:", ethers.formatEther(totalCollateral), "ETH");
  console.log("总借贷量:", ethers.formatUnits(totalBorrowed, 6), "USDC");
  console.log("ETH价格:", ethers.formatUnits(ethPrice, 6), "USDC");

  // 检查抵押率
  const collateralRatio = await collateralVault.getCollateralRatio(deployer.address);
  console.log("用户抵押率:", collateralRatio.toString(), "%");

  // 检查可借金额
  const borrowableAmount = await collateralVault.getBorrowableAmount(deployer.address);
  console.log("可借金额:", ethers.formatUnits(borrowableAmount, 6), "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 