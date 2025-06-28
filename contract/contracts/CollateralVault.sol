// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CollateralVault
 * @dev 抵押金库合约，支持ETH抵押和借贷
 * 要求抵押率至少为150%（抵押资产价值 >= 借贷资产价值的1.5倍）
 */
contract CollateralVault is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // 常量
    uint256 public constant MIN_COLLATERAL_RATIO = 150; // 150% = 1.5倍
    uint256 public constant LIQUIDATION_THRESHOLD = 125; // 125% = 1.25倍，低于此值可被清算
    uint256 public constant LIQUIDATION_PENALTY = 10; // 10% 清算惩罚
    uint256 public constant PRECISION = 100;

    // 状态变量
    IERC20 public immutable borrowToken; // 借贷代币（如USDC、USDT等）
    uint256 public totalCollateral; // 总抵押ETH数量
    uint256 public totalBorrowed; // 总借贷数量
    uint256 public ethPrice; // ETH价格（以借贷代币计价，如USDC）

    // 用户抵押信息
    struct UserCollateral {
        uint256 ethAmount; // 抵押的ETH数量
        uint256 borrowedAmount; // 借贷数量
        uint256 lastUpdateTime; // 最后更新时间
    }

    mapping(address => UserCollateral) public userCollaterals;

    // 事件
    event CollateralDeposited(address indexed user, uint256 ethAmount);
    event CollateralWithdrawn(address indexed user, uint256 ethAmount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 ethAmount, uint256 debtAmount);
    event EthPriceUpdated(uint256 newPrice);

    // 错误
    error InsufficientCollateral();
    error InsufficientBalance();
    error InvalidAmount();
    error LiquidationThresholdReached();
    error CollateralRatioTooLow();

    constructor(address _borrowToken, uint256 _initialEthPrice) Ownable(msg.sender) {
        borrowToken = IERC20(_borrowToken);
        ethPrice = _initialEthPrice;
    }

    /**
     * @dev 抵押ETH
     */
    function depositCollateral() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Amount must be greater than 0");
        
        UserCollateral storage user = userCollaterals[msg.sender];
        user.ethAmount += msg.value;
        user.lastUpdateTime = block.timestamp;
        
        totalCollateral += msg.value;
        
        emit CollateralDeposited(msg.sender, msg.value);
    }

    /**
     * @dev 提取抵押的ETH
     */
    function withdrawCollateral(uint256 ethAmount) external nonReentrant whenNotPaused {
        require(ethAmount > 0, "Amount must be greater than 0");
        
        UserCollateral storage user = userCollaterals[msg.sender];
        require(user.ethAmount >= ethAmount, "Insufficient collateral");
        
        // 检查提取后是否仍满足抵押率要求
        uint256 remainingEth = user.ethAmount - ethAmount;
        uint256 collateralValue = remainingEth * ethPrice;
        uint256 borrowedValue = user.borrowedAmount * (10 ** 18); // 假设借贷代币有18位小数
        
        if (user.borrowedAmount > 0) {
            uint256 collateralRatio = (collateralValue * 100) / borrowedValue;
            require(collateralRatio >= MIN_COLLATERAL_RATIO, "Collateral ratio too low");
        }
        
        user.ethAmount = remainingEth;
        user.lastUpdateTime = block.timestamp;
        
        totalCollateral -= ethAmount;
        
        (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        
        emit CollateralWithdrawn(msg.sender, ethAmount);
    }

    /**
     * @dev 借贷
     */
    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        UserCollateral storage user = userCollaterals[msg.sender];
        require(user.ethAmount > 0, "No collateral deposited");
        
        // 计算新的借贷后的抵押率
        uint256 newBorrowedAmount = user.borrowedAmount + amount;
        uint256 collateralValue = user.ethAmount * ethPrice;
        uint256 borrowedValue = newBorrowedAmount * (10 ** 18);
        
        uint256 collateralRatio = (collateralValue * 100) / borrowedValue;
        require(collateralRatio >= MIN_COLLATERAL_RATIO, "Collateral ratio too low");
        
        // 检查合约余额
        require(borrowToken.balanceOf(address(this)) >= amount, "Insufficient liquidity");
        
        user.borrowedAmount = newBorrowedAmount;
        user.lastUpdateTime = block.timestamp;
        
        totalBorrowed += amount;
        
        borrowToken.safeTransfer(msg.sender, amount);
        
        emit Borrowed(msg.sender, amount);
    }

    /**
     * @dev 还款
     */
    function repay(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        UserCollateral storage user = userCollaterals[msg.sender];
        require(user.borrowedAmount >= amount, "Repay amount exceeds borrowed amount");
        
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
        
        user.borrowedAmount -= amount;
        user.lastUpdateTime = block.timestamp;
        
        totalBorrowed -= amount;
        
        emit Repaid(msg.sender, amount);
    }

    /**
     * @dev 清算功能
     */
    function liquidate(address user) external nonReentrant whenNotPaused {
        UserCollateral storage userCollateral = userCollaterals[user];
        require(userCollateral.ethAmount > 0, "No collateral to liquidate");
        
        uint256 collateralValue = userCollateral.ethAmount * ethPrice;
        uint256 borrowedValue = userCollateral.borrowedAmount * (10 ** 18);
        
        uint256 collateralRatio = (collateralValue * 100) / borrowedValue;
        require(collateralRatio < LIQUIDATION_THRESHOLD, "Not eligible for liquidation");
        
        // 计算清算数量（清算全部债务）
        uint256 debtToLiquidate = userCollateral.borrowedAmount;
        uint256 ethToLiquidate = userCollateral.ethAmount;
        
        // 计算清算奖励（10%的ETH）
        uint256 liquidationReward = (ethToLiquidate * LIQUIDATION_PENALTY) / 100;
        uint256 ethToReturn = ethToLiquidate - liquidationReward;
        
        // 转移债务代币给清算者
        borrowToken.safeTransferFrom(msg.sender, address(this), debtToLiquidate);
        
        // 转移ETH给清算者
        (bool success, ) = payable(msg.sender).call{value: liquidationReward}("");
        require(success, "ETH transfer failed");
        
        // 转移剩余ETH给被清算用户
        if (ethToReturn > 0) {
            (bool success2, ) = payable(user).call{value: ethToReturn}("");
            require(success2, "ETH transfer failed");
        }
        
        // 更新状态
        totalCollateral -= ethToLiquidate;
        totalBorrowed -= debtToLiquidate;
        
        delete userCollaterals[user];
        
        emit Liquidated(user, msg.sender, ethToLiquidate, debtToLiquidate);
    }

    /**
     * @dev 获取用户抵押率
     */
    function getCollateralRatio(address user) external view returns (uint256) {
        UserCollateral memory userCollateral = userCollaterals[user];
        if (userCollateral.borrowedAmount == 0) return type(uint256).max;
        
        uint256 collateralValue = userCollateral.ethAmount * ethPrice;
        uint256 borrowedValue = userCollateral.borrowedAmount * (10 ** 18);
        
        return (collateralValue * 100) / borrowedValue;
    }

    /**
     * @dev 获取用户可借金额
     */
    function getBorrowableAmount(address user) external view returns (uint256) {
        UserCollateral memory userCollateral = userCollaterals[user];
        if (userCollateral.ethAmount == 0) return 0;
        
        uint256 collateralValue = userCollateral.ethAmount * ethPrice;
        uint256 maxBorrowValue = (collateralValue * 100) / MIN_COLLATERAL_RATIO;
        uint256 currentBorrowValue = userCollateral.borrowedAmount * (10 ** 18);
        
        if (currentBorrowValue >= maxBorrowValue) return 0;
        
        return (maxBorrowValue - currentBorrowValue) / (10 ** 18);
    }

    /**
     * @dev 更新ETH价格（仅管理员）
     */
    function updateEthPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than 0");
        ethPrice = newPrice;
        emit EthPriceUpdated(newPrice);
    }

    /**
     * @dev 添加流动性（管理员功能）
     */
    function addLiquidity(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @dev 移除流动性（管理员功能）
     */
    function removeLiquidity(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(borrowToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        borrowToken.safeTransfer(msg.sender, amount);
    }

    /**
     * @dev 紧急暂停
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 接收ETH
     */
    receive() external payable {
        revert("Direct ETH deposits not allowed");
    }
} 