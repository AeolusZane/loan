const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("抵押系统测试", function () {
  let mockUSDC, collateralVault, owner, user1, user2;
  let mockUSDCAddress, collateralVaultAddress;

  beforeEach(async function () {
    // 获取账户
    [owner, user1, user2] = await ethers.getSigners();

    // 部署MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    mockUSDCAddress = await mockUSDC.getAddress();

    // 设置初始ETH价格（2000 USDC per ETH）
    const initialEthPrice = ethers.parseUnits("2000", 6);

    // 部署CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    collateralVault = await CollateralVault.deploy(mockUSDCAddress, initialEthPrice);
    await collateralVault.waitForDeployment();
    collateralVaultAddress = await collateralVault.getAddress();

    // 为抵押金库添加流动性
    const initialLiquidity = ethers.parseUnits("1000000", 6);
    await mockUSDC.mint(collateralVaultAddress, initialLiquidity);

    // 为用户铸造一些USDC
    const userAmount = ethers.parseUnits("10000", 6);
    await mockUSDC.mint(user1.address, userAmount);
    await mockUSDC.mint(user2.address, userAmount);
  });

  describe("基础功能测试", function () {
    it("应该正确部署合约", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USDC");
      expect(await mockUSDC.symbol()).to.equal("mUSDC");
      expect(await mockUSDC.decimals()).to.equal(6);
      
      expect(await collateralVault.borrowToken()).to.equal(mockUSDCAddress);
      expect(await collateralVault.ethPrice()).to.equal(ethers.parseUnits("2000", 6));
      expect(await collateralVault.MIN_COLLATERAL_RATIO()).to.equal(150);
    });

    it("应该能够抵押ETH", async function () {
      const depositAmount = ethers.parseEther("1");
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      const userCollateral = await collateralVault.userCollaterals(user1.address);
      expect(userCollateral.ethAmount).to.equal(depositAmount);
      expect(await collateralVault.totalCollateral()).to.equal(depositAmount);
      
      // 检查ETH余额减少
      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance).to.be.lt(initialBalance - depositAmount); // 考虑gas费用
    });

    it("应该能够借贷USDC", async function () {
      // 先抵押ETH
      const depositAmount = ethers.parseEther("2");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      // 借贷USDC
      const borrowAmount = ethers.parseUnits("2000", 6); // 2000 USDC
      const initialUSDCBalance = await mockUSDC.balanceOf(user1.address);
      
      await collateralVault.connect(user1).borrow(borrowAmount);
      
      const userCollateral = await collateralVault.userCollaterals(user1.address);
      expect(userCollateral.borrowedAmount).to.equal(borrowAmount);
      expect(await collateralVault.totalBorrowed()).to.equal(borrowAmount);
      
      // 检查USDC余额增加
      const finalUSDCBalance = await mockUSDC.balanceOf(user1.address);
      expect(finalUSDCBalance).to.equal(initialUSDCBalance + borrowAmount);
    });

    it("应该能够还款", async function () {
      // 先抵押和借贷
      const depositAmount = ethers.parseEther("2");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      const borrowAmount = ethers.parseUnits("2000", 6);
      await collateralVault.connect(user1).borrow(borrowAmount);
      
      // 还款
      const repayAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).approve(collateralVaultAddress, repayAmount);
      await collateralVault.connect(user1).repay(repayAmount);
      
      const userCollateral = await collateralVault.userCollaterals(user1.address);
      expect(userCollateral.borrowedAmount).to.equal(borrowAmount - repayAmount);
      expect(await collateralVault.totalBorrowed()).to.equal(borrowAmount - repayAmount);
    });

    it("应该能够提取抵押的ETH", async function () {
      // 先抵押ETH
      const depositAmount = ethers.parseEther("2");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      // 提取部分ETH
      const withdrawAmount = ethers.parseEther("0.5");
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      await collateralVault.connect(user1).withdrawCollateral(withdrawAmount);
      
      const userCollateral = await collateralVault.userCollaterals(user1.address);
      expect(userCollateral.ethAmount).to.equal(depositAmount - withdrawAmount);
      expect(await collateralVault.totalCollateral()).to.equal(depositAmount - withdrawAmount);
      
      // 检查ETH余额增加
      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance).to.be.gt(initialBalance + withdrawAmount - ethers.parseEther("0.01")); // 考虑gas费用
    });
  });

  describe("抵押率测试", function () {
    it("应该拒绝抵押率过低的借贷", async function () {
      // 抵押1 ETH
      const depositAmount = ethers.parseEther("1");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      // 尝试借贷超过抵押率允许的金额
      const borrowAmount = ethers.parseUnits("1500", 6); // 1500 USDC，抵押率约为133%
      
      await expect(
        collateralVault.connect(user1).borrow(borrowAmount)
      ).to.be.revertedWith("Collateral ratio too low");
    });

    it("应该拒绝提取导致抵押率过低的ETH", async function () {
      // 抵押2 ETH，借贷2000 USDC
      const depositAmount = ethers.parseEther("2");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      const borrowAmount = ethers.parseUnits("2000", 6);
      await collateralVault.connect(user1).borrow(borrowAmount);
      
      // 尝试提取过多ETH
      const withdrawAmount = ethers.parseEther("1.5");
      
      await expect(
        collateralVault.connect(user1).withdrawCollateral(withdrawAmount)
      ).to.be.revertedWith("Collateral ratio too low");
    });

    it("应该正确计算抵押率", async function () {
      // 抵押1 ETH，借贷1000 USDC
      const depositAmount = ethers.parseEther("1");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      const borrowAmount = ethers.parseUnits("1000", 6);
      await collateralVault.connect(user1).borrow(borrowAmount);
      
      // 计算抵押率：1 ETH * 2000 USDC / 1000 USDC = 200%
      const collateralRatio = await collateralVault.getCollateralRatio(user1.address);
      expect(collateralRatio).to.equal(200);
    });

    it("应该正确计算可借金额", async function () {
      // 抵押1 ETH
      const depositAmount = ethers.parseEther("1");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      // 计算可借金额：1 ETH * 2000 USDC / 1.5 = 1333.33 USDC
      const borrowableAmount = await collateralVault.getBorrowableAmount(user1.address);
      // 由于精度问题，我们检查大约的值
      expect(borrowableAmount).to.be.closeTo(ethers.parseUnits("1333", 6), ethers.parseUnits("1", 6));
    });
  });

  describe("清算测试", function () {
    it("应该能够清算抵押率过低的用户", async function () {
      // 用户1抵押1 ETH，借贷1201 USDC（抵押率167%）
      const depositAmount = ethers.parseEther("1");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      const borrowAmount = ethers.parseUnits("1201", 6);
      await collateralVault.connect(user1).borrow(borrowAmount);
      
      // 降低ETH价格到1500 USDC，使抵押率变为125%
      await collateralVault.connect(owner).updateEthPrice(ethers.parseUnits("1500", 6));
      
      // 用户2进行清算
      await mockUSDC.connect(user2).approve(collateralVaultAddress, borrowAmount);
      
      const initialUser2Balance = await ethers.provider.getBalance(user2.address);
      
      await collateralVault.connect(user2).liquidate(user1.address);
      
      // 检查清算结果
      const userCollateral = await collateralVault.userCollaterals(user1.address);
      expect(userCollateral.ethAmount).to.equal(0);
      expect(userCollateral.borrowedAmount).to.equal(0);
      
      // 检查清算者获得奖励
      const finalUser2Balance = await ethers.provider.getBalance(user2.address);
      expect(finalUser2Balance).to.be.gt(initialUser2Balance);
    });

    it("应该拒绝清算抵押率正常的用户", async function () {
      // 用户1抵押2 ETH，借贷2000 USDC（抵押率200%）
      const depositAmount = ethers.parseEther("2");
      await collateralVault.connect(user1).depositCollateral({ value: depositAmount });
      
      const borrowAmount = ethers.parseUnits("2000", 6);
      await collateralVault.connect(user1).borrow(borrowAmount);
      
      await mockUSDC.connect(user2).approve(collateralVaultAddress, borrowAmount);
      
      await expect(
        collateralVault.connect(user2).liquidate(user1.address)
      ).to.be.revertedWith("Not eligible for liquidation");
    });
  });

  describe("管理员功能测试", function () {
    it("应该能够更新ETH价格", async function () {
      const newPrice = ethers.parseUnits("2500", 6);
      await collateralVault.connect(owner).updateEthPrice(newPrice);
      
      expect(await collateralVault.ethPrice()).to.equal(newPrice);
    });

    it("应该能够暂停和恢复合约", async function () {
      await collateralVault.connect(owner).pause();
      expect(await collateralVault.paused()).to.be.true;
      
      await collateralVault.connect(owner).unpause();
      expect(await collateralVault.paused()).to.be.false;
    });

    it("非管理员不能执行管理员功能", async function () {
      const newPrice = ethers.parseUnits("2500", 6);
      
      await expect(
        collateralVault.connect(user1).updateEthPrice(newPrice)
      ).to.be.reverted;
      
      await expect(
        collateralVault.connect(user1).pause()
      ).to.be.reverted;
    });
  });
}); 