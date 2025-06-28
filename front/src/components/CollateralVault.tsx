import React, { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useCollateralVault, useDepositCollateral, useWithdrawCollateral, useBorrow, useRepay } from '../hooks/useCollateralVault';
import { CONTRACT_ADDRESSES } from '../contracts/config';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Card, InfoRow, Button, Input } from './Card';

// 图标组件 - 使用简单文本
const StatsIcon = () => <span className="text-blue-600 text-lg">📊</span>;
const OperationsIcon = () => <span className="text-blue-600 text-lg">⚙️</span>;
const UserIcon = () => <span className="text-blue-600 text-lg">👤</span>;

const CollateralVault: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { userCollateral, vaultStats, collateralRatio, borrowableAmount, usdcAllowance, refetchUserCollateral } = useCollateralVault();
  
  const { depositCollateral, isLoading: isDepositing, isSuccess: isDepositSuccess } = useDepositCollateral();
  const { withdrawCollateral, isLoading: isWithdrawing, isSuccess: isWithdrawSuccess } = useWithdrawCollateral();
  const { borrow, isLoading: isBorrowing, isSuccess: isBorrowSuccess } = useBorrow();
  const { repay, executeRepay, resetAuthorization, isLoading: isRepaying, isSuccess: isRepaySuccess, isApproveSuccess, usdcBalance: repayUsdcBalance } = useRepay();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  
  // 获取用户ETH余额
  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({
    address,
  });

  // 获取用户USDC余额
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useBalance({
    address,
    token: CONTRACT_ADDRESSES.MOCK_USDC as `0x${string}`,
  });

  // 交易成功后刷新所有数据
  useEffect(() => {
    if (isDepositSuccess || isWithdrawSuccess || isBorrowSuccess || isRepaySuccess) {
      console.log('Transaction success detected:', { isDepositSuccess, isWithdrawSuccess, isBorrowSuccess, isRepaySuccess });
      
      // 立即刷新
      refetchUserCollateral();
      refetchEthBalance();
      refetchUsdcBalance();
      
      // 如果是还款成功，只重置授权状态，不清空输入框
      if (isRepaySuccess) {
        console.log('Repay success, resetting authorization only');
        resetAuthorization();
        // 不清空输入框，让用户可以继续使用
      }
      
      // 延迟刷新，确保合约状态已更新
      const timer = setTimeout(() => {
        refetchUserCollateral();
        refetchEthBalance();
        refetchUsdcBalance();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isDepositSuccess, isWithdrawSuccess, isBorrowSuccess, isRepaySuccess, refetchUserCollateral, refetchEthBalance, refetchUsdcBalance, resetAuthorization]);

  const handleRefresh = () => {
    refetchUserCollateral();
    refetchEthBalance();
    refetchUsdcBalance();
  };

  const handleDeposit = () => {
    if (depositAmount && parseFloat(depositAmount) > 0) {
      depositCollateral(depositAmount);
      setDepositAmount('');
    }
  };

  const handleWithdraw = () => {
    if (withdrawAmount && parseFloat(withdrawAmount) > 0) {
      withdrawCollateral(withdrawAmount);
      setWithdrawAmount('');
    }
  };

  const handleBorrow = () => {
    if (borrowAmount && parseFloat(borrowAmount) > 0) {
      borrow(borrowAmount);
      setBorrowAmount('');
    }
  };

  const handleRepay = () => {
    if (repayAmount && parseFloat(repayAmount) > 0) {
      repay(repayAmount);
    }
  };

  const handleExecuteRepay = () => {
    if (repayAmount && parseFloat(repayAmount) > 0) {
      executeRepay(repayAmount);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">🔒</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">连接钱包</h2>
              <p className="text-gray-600">请连接您的钱包以使用抵押系统</p>
            </div>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">抵押系统</h1>
            <p className="text-gray-600 mt-1">管理您的ETH抵押和USDC借贷</p>
          </div>
          <ConnectButton />
        </div>

        {/* 主要内容区域 */}
        <div className="flex flex-col space-y-6">
          {/* 系统总览 */}
          <Card title="系统总览" icon={<StatsIcon />} className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative pr-6">
                <InfoRow 
                  label="总抵押量" 
                  value={vaultStats?.totalCollateral || '0'} 
                  unit="ETH" 
                />
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-8 bg-gray-300"></div>
              </div>
              <div className="relative pr-6">
                <InfoRow 
                  label="总借贷量" 
                  value={vaultStats?.totalBorrowed || '0'} 
                  unit="USDC" 
                />
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-8 bg-gray-300"></div>
              </div>
              <div className="relative pr-6">
                <InfoRow 
                  label="ETH价格" 
                  value={vaultStats?.ethPrice || '0'} 
                  unit="USDC" 
                />
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-8 bg-gray-300"></div>
              </div>
              <div className="relative">
                <InfoRow 
                  label="您的抵押率" 
                  value={collateralRatio === '无借贷' ? '无借贷' : `${collateralRatio}%`} 
                  className="text-lg"
                />
              </div>
            </div>
            
            {/* 公式说明 */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                <div className="font-medium mb-1">💡 抵押率 = (ETH数量 × ETH价格) ÷ USDC借贷量 × 100%</div>
                <div className="flex gap-4">
                  <span>安全线: ≥150%</span>
                  <span>清算线: ≤125%</span>
                </div>
              </div>
            </div>
          </Card>

          {/* 操作面板 */}
          <Card title="操作面板" icon={<OperationsIcon />} className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* 抵押操作 */}
              <div className="space-y-3 relative pr-6">
                <h4 className="font-medium text-gray-700">抵押ETH</h4>
                <Input
                  label="抵押数量"
                  value={depositAmount}
                  onChange={setDepositAmount}
                  placeholder="0.0"
                  unit="ETH"
                />
                <Button 
                  onClick={handleDeposit}
                  loading={isDepositing}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                  className="w-full"
                >
                  抵押ETH
                </Button>
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-32 bg-gray-300"></div>
              </div>

              {/* 提取操作 */}
              <div className="space-y-3 relative pr-6">
                <h4 className="font-medium text-gray-700">提取ETH</h4>
                <Input
                  label="提取数量"
                  value={withdrawAmount}
                  onChange={setWithdrawAmount}
                  placeholder="0.0"
                  unit="ETH"
                />
                <Button 
                  onClick={handleWithdraw}
                  loading={isWithdrawing}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  variant="secondary"
                  className="w-full"
                >
                  提取ETH
                </Button>
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-32 bg-gray-300"></div>
              </div>

              {/* 借贷操作 */}
              <div className="space-y-3 relative pr-6">
                <h4 className="font-medium text-gray-700">借贷USDC</h4>
                <Input
                  label="借贷数量"
                  value={borrowAmount}
                  onChange={setBorrowAmount}
                  placeholder="0.0"
                  unit="USDC"
                />
                <Button 
                  onClick={handleBorrow}
                  loading={isBorrowing}
                  disabled={!borrowAmount || parseFloat(borrowAmount) <= 0}
                  className="w-full"
                >
                  借贷USDC
                </Button>
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-32 bg-gray-300"></div>
              </div>

              {/* 还款操作 */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700">还款USDC</h4>
                
                {/* USDC余额显示 */}
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-700">USDC余额:</span>
                    <span className="font-medium text-blue-800">
                      {repayUsdcBalance ? parseFloat(repayUsdcBalance.formatted).toFixed(2) : '0.00'} USDC
                    </span>
                  </div>
                </div>
                
                {/* USDC授权额度显示 */}
                <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-700">授权额度:</span>
                    <span className="font-medium text-green-800">
                      {parseFloat(usdcAllowance).toFixed(2)} USDC
                    </span>
                  </div>
                </div>
                
                <Input
                  label="还款数量"
                  value={repayAmount}
                  onChange={(value) => {
                    console.log('Repay amount changed:', value);
                    // 确保值不为空时才更新状态
                    if (value !== undefined && value !== null) {
                      setRepayAmount(value);
                    }
                  }}
                  placeholder="0.0"
                  unit="USDC"
                />
                
                {/* 清空输入框按钮 */}
                {repayAmount && (
                  <button
                    onClick={() => {
                      console.log('Manually clearing repay input');
                      setRepayAmount('');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    清空输入
                  </button>
                )}
                
                {/* 余额不足提示 */}
                {repayAmount && repayUsdcBalance && parseFloat(repayAmount) > parseFloat(repayUsdcBalance.formatted) && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600">⚠️</span>
                      <span className="text-sm text-red-800">USDC余额不足</span>
                    </div>
                  </div>
                )}
                
                {/* 授权状态提示 */}
                {repayAmount && parseFloat(repayAmount) > 0 && (
                  <div className={`p-2 border rounded-lg ${
                    parseFloat(usdcAllowance) >= parseFloat(repayAmount) 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={parseFloat(usdcAllowance) >= parseFloat(repayAmount) ? 'text-green-600' : 'text-yellow-600'}>
                        {parseFloat(usdcAllowance) >= parseFloat(repayAmount) ? '✅' : '⚠️'}
                      </span>
                      <span className={`text-sm ${
                        parseFloat(usdcAllowance) >= parseFloat(repayAmount) ? 'text-green-800' : 'text-yellow-800'
                      }`}>
                        {parseFloat(usdcAllowance) >= parseFloat(repayAmount) 
                          ? `授权额度充足，可直接还款` 
                          : `需要先授权 ${parseFloat(repayAmount) - parseFloat(usdcAllowance)} USDC`
                        }
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  {/* 如果授权额度足够，直接显示还款按钮 */}
                  {parseFloat(usdcAllowance) >= parseFloat(repayAmount || '0') && repayAmount && parseFloat(repayAmount) > 0 ? (
                    <Button 
                      onClick={handleExecuteRepay}
                      loading={isRepaying}
                      disabled={!repayAmount || parseFloat(repayAmount) <= 0 || (repayUsdcBalance && parseFloat(repayAmount) > parseFloat(repayUsdcBalance.formatted))}
                      className="w-full"
                    >
                      还款USDC
                    </Button>
                  ) : (
                    /* 如果授权额度不足，显示授权按钮 */
                    <Button 
                      onClick={handleRepay}
                      loading={isRepaying && !isApproveSuccess}
                      disabled={!repayAmount || parseFloat(repayAmount) <= 0 || isApproveSuccess || (repayUsdcBalance && parseFloat(repayAmount) > parseFloat(repayUsdcBalance.formatted))}
                      variant="secondary"
                      className="w-full"
                    >
                      {isApproveSuccess ? '已授权' : '授权USDC'}
                    </Button>
                  )}
                  
                  {/* 如果授权成功但还没有直接还款，显示还款按钮 */}
                  {isApproveSuccess && parseFloat(usdcAllowance) < parseFloat(repayAmount || '0') && (
                    <Button 
                      onClick={handleExecuteRepay}
                      loading={isRepaying}
                      disabled={!repayAmount || parseFloat(repayAmount) <= 0 || (repayUsdcBalance && parseFloat(repayAmount) > parseFloat(repayUsdcBalance.formatted))}
                      className="w-full"
                    >
                      还款USDC
                    </Button>
                  )}
                  
                  {/* 调试按钮 */}
                  <Button 
                    onClick={() => {
                      console.log('Debug: Testing contract call');
                      console.log('Contract address:', CONTRACT_ADDRESSES.COLLATERAL_VAULT);
                      console.log('User address:', address);
                      console.log('Repay amount:', repayAmount);
                      console.log('Is authorized:', isApproveSuccess);
                      console.log('USDC allowance:', usdcAllowance);
                      console.log('USDC balance:', repayUsdcBalance?.formatted);
                      console.log('Can repay directly:', parseFloat(usdcAllowance) >= parseFloat(repayAmount || '0'));
                    }}
                    variant="secondary"
                    className="w-full text-xs"
                  >
                    调试信息
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* 用户信息 */}
          <Card title="我的抵押" icon={<UserIcon />} className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative pr-6">
                <InfoRow 
                  label="抵押的ETH" 
                  value={userCollateral?.ethAmount || '0'} 
                  unit="ETH" 
                />
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-8 bg-gray-300"></div>
              </div>
              <div className="relative pr-6">
                <InfoRow 
                  label="借贷的USDC" 
                  value={userCollateral?.borrowedAmount || '0'} 
                  unit="USDC" 
                />
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-8 bg-gray-300"></div>
              </div>
              <div className="relative pr-6">
                <InfoRow 
                  label="可借金额" 
                  value={borrowableAmount} 
                  unit="USDC" 
                />
                <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 w-px h-8 bg-gray-300"></div>
              </div>
              <div className="relative">
                <InfoRow 
                  label="抵押率" 
                  value={collateralRatio === '无借贷' ? '无借贷' : `${collateralRatio}%`} 
                  className="text-lg font-bold"
                />
              </div>
            </div>
            
            {/* 抵押率计算公式说明 */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">📊 抵押率计算公式</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">抵押率 =</span>
                  <span className="bg-white px-2 py-1 rounded border">(抵押ETH数量 × ETH价格) ÷ 借贷USDC数量 × 100%</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  <div>• 当前ETH价格: {vaultStats?.ethPrice || '0'} USDC</div>
                  <div>• 最低抵押率要求: 150%</div>
                  <div>• 清算阈值: 125%</div>
                </div>
                {userCollateral && parseFloat(userCollateral.ethAmount) > 0 && parseFloat(userCollateral.borrowedAmount) > 0 && collateralRatio !== '无借贷' && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <div className="font-medium text-blue-800 mb-1">当前计算示例:</div>
                    <div className="text-blue-700">
                      ({userCollateral.ethAmount} ETH × {vaultStats?.ethPrice || '0'} USDC) ÷ {userCollateral.borrowedAmount} USDC × 100% = {collateralRatio}%
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* 风险提示 */}
            {collateralRatio !== '无借贷' && parseFloat(collateralRatio) < 150 && parseFloat(collateralRatio) > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600">⚠️</span>
                  <span className="text-sm text-yellow-800 font-medium">
                    抵押率低于150%，请注意风险
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CollateralVault; 