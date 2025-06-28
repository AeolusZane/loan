import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction, useBalance } from 'wagmi';
import CollateralVaultABI from '../contracts/abi/CollateralVault.json';
import MockUSDCABI from '../contracts/abi/MockUSDC.json';
import { CONTRACT_ADDRESSES } from '../contracts/config';

export interface UserCollateral {
  ethAmount: string;
  borrowedAmount: string;
  lastUpdateTime: string;
}

export interface VaultStats {
  totalCollateral: string;
  totalBorrowed: string;
  ethPrice: string;
}

export const useCollateralVault = () => {
  const { address } = useAccount();
  const [userCollateral, setUserCollateral] = useState<UserCollateral | null>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>({
    totalCollateral: '0',
    totalBorrowed: '0',
    ethPrice: '0',
  });
  const [collateralRatio, setCollateralRatio] = useState<string>('0');
  const [borrowableAmount, setBorrowableAmount] = useState<string>('0');
  const [usdcAllowanceFormatted, setUsdcAllowanceFormatted] = useState<string>('0');

  // 添加调试信息
  console.log('Contract addresses:', CONTRACT_ADDRESSES);
  console.log('User address:', address);

  // 读取用户抵押信息
  const { data: userCollateralData, refetch: refetchUserCollateral, error: userCollateralError } = useContractRead({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'userCollaterals',
    args: [address],
    enabled: !!address && !!CONTRACT_ADDRESSES.COLLATERAL_VAULT,
    watch: true,
  });

  // 读取金库统计信息
  const { data: totalCollateral, error: totalCollateralError } = useContractRead({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'totalCollateral',
    enabled: !!CONTRACT_ADDRESSES.COLLATERAL_VAULT,
    watch: true,
  });

  const { data: totalBorrowed, error: totalBorrowedError } = useContractRead({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'totalBorrowed',
    enabled: !!CONTRACT_ADDRESSES.COLLATERAL_VAULT,
    watch: true,
  });

  const { data: ethPrice, error: ethPriceError } = useContractRead({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'ethPrice',
    enabled: !!CONTRACT_ADDRESSES.COLLATERAL_VAULT,
    watch: true,
  });

  // 读取用户抵押率
  const { data: collateralRatioData, error: collateralRatioError } = useContractRead({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'getCollateralRatio',
    args: [address],
    enabled: !!address && !!CONTRACT_ADDRESSES.COLLATERAL_VAULT,
    watch: true,
  });

  // 读取可借金额
  const { data: borrowableAmountData, error: borrowableAmountError } = useContractRead({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'getBorrowableAmount',
    args: [address],
    enabled: !!address && !!CONTRACT_ADDRESSES.COLLATERAL_VAULT,
    watch: true,
  });

  // 读取USDC授权额度
  const { data: usdcAllowance, error: usdcAllowanceError } = useContractRead({
    address: CONTRACT_ADDRESSES.MOCK_USDC as `0x${string}`,
    abi: MockUSDCABI,
    functionName: 'allowance',
    args: [address, CONTRACT_ADDRESSES.COLLATERAL_VAULT],
    enabled: !!address && !!CONTRACT_ADDRESSES.MOCK_USDC && !!CONTRACT_ADDRESSES.COLLATERAL_VAULT,
    watch: true,
  });

  // 调试错误信息
  if (userCollateralError) console.log('User collateral error:', userCollateralError);
  if (totalCollateralError) console.log('Total collateral error:', totalCollateralError);
  if (totalBorrowedError) console.log('Total borrowed error:', totalBorrowedError);
  if (ethPriceError) console.log('ETH price error:', ethPriceError);
  if (collateralRatioError) console.log('Collateral ratio error:', collateralRatioError);
  if (borrowableAmountError) console.log('Borrowable amount error:', borrowableAmountError);
  if (usdcAllowanceError) console.log('USDC allowance error:', usdcAllowanceError);

  // 调试数据
  console.log('Raw data:', {
    userCollateralData,
    totalCollateral,
    totalBorrowed,
    ethPrice,
    collateralRatioData,
    borrowableAmountData,
    usdcAllowance
  }); 

  // 更新状态
  useEffect(() => {
    if (userCollateralData && Array.isArray(userCollateralData) && userCollateralData.length >= 3) {
      console.log('User collateral data array:', userCollateralData);
      setUserCollateral({
        ethAmount: ethers.formatEther(userCollateralData[0] || 0),
        borrowedAmount: ethers.formatUnits(userCollateralData[1] || 0, 6),
        lastUpdateTime: (userCollateralData[2] || 0).toString(),
      });
    } else {
      // 如果没有数据，设置为默认值
      setUserCollateral({
        ethAmount: '0',
        borrowedAmount: '0',
        lastUpdateTime: '0',
      });
    }
  }, [userCollateralData]);

  useEffect(() => {
    if (totalCollateral !== undefined && totalCollateral !== null && 
        totalBorrowed !== undefined && totalBorrowed !== null && 
        ethPrice !== undefined && ethPrice !== null) {
      console.log('Setting vault stats:', {
        totalCollateral: totalCollateral.toString(),
        totalBorrowed: totalBorrowed.toString(),
        ethPrice: ethPrice.toString()
      });
      
      setVaultStats({
        totalCollateral: ethers.formatEther(totalCollateral as any),
        totalBorrowed: ethers.formatUnits(totalBorrowed as any, 6),
        ethPrice: ethers.formatUnits(ethPrice as any, 6),
      });
    }
  }, [totalCollateral, totalBorrowed, ethPrice]);

  useEffect(() => {
    if (collateralRatioData !== undefined && collateralRatioData !== null) {
      // 合约返回的是原始的百分比数值（如200表示200%）
      const ratioNumber = Number(collateralRatioData);
      
      // 检查是否为异常的大数字（通常是type(uint256).max，表示没有借贷）
      if (ratioNumber > 1000000) {
        setCollateralRatio('无借贷');
      } else {
        setCollateralRatio(ratioNumber.toFixed(2));
      }
    } else {
      setCollateralRatio('无借贷');
    }
  }, [collateralRatioData]);

  useEffect(() => {
    if (borrowableAmountData !== undefined && borrowableAmountData !== null) {
      setBorrowableAmount(ethers.formatUnits(borrowableAmountData as any, 6));
    } else {
      setBorrowableAmount('0');
    }
  }, [borrowableAmountData]);

  useEffect(() => {
    if (usdcAllowance !== undefined && usdcAllowance !== null) {
      setUsdcAllowanceFormatted(ethers.formatUnits(usdcAllowance as any, 6));
    } else {
      setUsdcAllowanceFormatted('0');
    }
  }, [usdcAllowance]);

  return {
    userCollateral,
    vaultStats,
    collateralRatio,
    borrowableAmount,
    usdcAllowance: usdcAllowanceFormatted,
    refetchUserCollateral,
  };
};

// 抵押ETH
export const useDepositCollateral = () => {
  const { refetchUserCollateral } = useCollateralVault();
  const { write, data, isLoading, error } = useContractWrite({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'depositCollateral',
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  // 交易成功后自动刷新数据
  useEffect(() => {
    if (isSuccess) {
      refetchUserCollateral();
    }
  }, [isSuccess, refetchUserCollateral]);

  const depositCollateral = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      console.error('Invalid deposit amount:', amount);
      return;
    }
    try {
      const value = ethers.parseEther(amount);
      write({ value });
    } catch (error) {
      console.error('Error parsing deposit amount:', error);
    }
  };

  return {
    depositCollateral,
    isLoading: isLoading || isConfirming,
    isSuccess,
    error,
    hash: data?.hash,
  };
};

// 提取抵押
export const useWithdrawCollateral = () => {
  const { refetchUserCollateral } = useCollateralVault();
  const { write, data, isLoading, error } = useContractWrite({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'withdrawCollateral',
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  // 交易成功后自动刷新数据
  useEffect(() => {
    if (isSuccess) {
      refetchUserCollateral();
    }
  }, [isSuccess, refetchUserCollateral]);

  const withdrawCollateral = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      console.error('Invalid withdraw amount:', amount);
      return;
    }
    try {
      const value = ethers.parseEther(amount);
      write({ args: [value] });
    } catch (error) {
      console.error('Error parsing withdraw amount:', error);
    }
  };

  return {
    withdrawCollateral,
    isLoading: isLoading || isConfirming,
    isSuccess,
    error,
    hash: data?.hash,
  };
};

// 借贷
export const useBorrow = () => {
  const { refetchUserCollateral } = useCollateralVault();
  const { write, data, isLoading, error } = useContractWrite({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'borrow',
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  // 交易成功后自动刷新数据
  useEffect(() => {
    if (isSuccess) {
      refetchUserCollateral();
    }
  }, [isSuccess, refetchUserCollateral]);

  const borrow = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      console.error('Invalid borrow amount:', amount);
      return;
    }
    try {
      const value = ethers.parseUnits(amount, 6);
      write({ args: [value] });
    } catch (error) {
      console.error('Error parsing borrow amount:', error);
    }
  };

  return {
    borrow,
    isLoading: isLoading || isConfirming,
    isSuccess,
    error,
    hash: data?.hash,
  };
};

// 还款
export const useRepay = () => {
  const { refetchUserCollateral } = useCollateralVault();
  const { address } = useAccount();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // 检查用户USDC余额
  const { data: usdcBalance } = useBalance({
    address,
    token: CONTRACT_ADDRESSES.MOCK_USDC as `0x${string}`,
  });

  const { write, data, isLoading, error } = useContractWrite({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'repay',
    onSuccess: (data) => {
      console.log('Repay transaction successful:', data);
    },
    onError: (error) => {
      console.error('Repay transaction failed:', error);
    },
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  // USDC授权
  const { write: approveWrite, data: approveData, isLoading: isApproving } = useContractWrite({
    address: CONTRACT_ADDRESSES.MOCK_USDC as `0x${string}`,
    abi: MockUSDCABI,
    functionName: 'approve',
  });

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransaction({
    hash: approveData?.hash,
  });

  // 交易成功后自动刷新数据
  useEffect(() => {
    if (isSuccess) {
      refetchUserCollateral();
      // 还款成功后重置授权状态
      setIsAuthorized(false);
      // 延迟刷新，确保合约状态已更新
      setTimeout(() => {
        refetchUserCollateral();
      }, 2000);
    }
  }, [isSuccess, refetchUserCollateral]);

  // 授权成功后，设置授权状态
  useEffect(() => {
    if (isApproveSuccess) {
      setIsAuthorized(true);
    }
  }, [isApproveSuccess]);

  const repay = async (amount: string, currentAllowance: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      console.error('Invalid repay amount:', amount);
      return;
    }
    
    // 检查USDC余额
    if (usdcBalance && parseFloat(usdcBalance.formatted) < parseFloat(amount)) {
      console.error('Insufficient USDC balance:', usdcBalance.formatted, 'needed:', amount);
      alert('USDC余额不足！');
      return;
    }
    
    try {
      const requiredAmount = ethers.parseUnits(amount, 6);
      const currentAllowanceBigInt = ethers.parseUnits(currentAllowance, 6);
      
      // 如果当前授权额度已经足够，直接执行还款
      if (currentAllowanceBigInt >= requiredAmount) {
        console.log('Allowance sufficient, executing repay directly');
        executeRepay(amount);
        return;
      }
      
      // 授权完整的还款金额（确保总授权额度足够）
      console.log('Approving USDC for contract...', {
        currentAllowance: currentAllowance,
        requiredAmount: ethers.formatUnits(requiredAmount, 6),
        totalToApprove: ethers.formatUnits(requiredAmount, 6),
        userBalance: usdcBalance?.formatted
      });
      
      // 授权完整的还款金额
      approveWrite({ 
        args: [CONTRACT_ADDRESSES.COLLATERAL_VAULT, requiredAmount] 
      });
    } catch (error) {
      console.error('Error in repay:', error);
    }
  };

  // 执行还款（在授权成功后调用）
  const executeRepay = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      console.error('Invalid repay amount:', amount);
      return;
    }
    
    // 再次检查USDC余额
    if (usdcBalance && parseFloat(usdcBalance.formatted) < parseFloat(amount)) {
      console.error('Insufficient USDC balance for repayment:', usdcBalance.formatted, 'needed:', amount);
      alert('USDC余额不足，无法还款！');
      return;
    }
    
    try {
      const value = ethers.parseUnits(amount, 6);
      console.log('Executing repay with amount:', value.toString());
      console.log('Contract address:', CONTRACT_ADDRESSES.COLLATERAL_VAULT);
      console.log('Write function available:', !!write);
      
      if (!write) {
        console.error('Write function is not available');
        alert('合约调用失败，请检查网络连接');
        return;
      }
      
      write({ args: [value] });
      console.log('Repay transaction initiated');
    } catch (error) {
      console.error('Error executing repay:', error);
      alert('还款失败，请重试');
    }
  };

  // 重置授权状态
  const resetAuthorization = () => {
    setIsAuthorized(false);
  };

  return {
    repay,
    executeRepay,
    resetAuthorization,
    isLoading: isLoading || isConfirming || isApproving || isApproveConfirming,
    isSuccess,
    isApproveSuccess: isAuthorized,
    error,
    usdcBalance,
    hash: data?.hash,
  };
};

// 清算
export const useLiquidate = () => {
  const { write, data, isLoading, error } = useContractWrite({
    address: CONTRACT_ADDRESSES.COLLATERAL_VAULT as `0x${string}`,
    abi: CollateralVaultABI,
    functionName: 'liquidate',
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const liquidate = (userAddress: string) => {
    if (!userAddress) {
      console.error('Invalid user address:', userAddress);
      return;
    }
    try {
      write({ args: [userAddress] });
    } catch (error) {
      console.error('Error liquidating user:', error);
    }
  };

  return {
    liquidate,
    isLoading: isLoading || isConfirming,
    isSuccess,
    error,
    hash: data?.hash,
  };
}; 