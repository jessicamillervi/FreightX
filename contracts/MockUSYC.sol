// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockUSYC {
    string public name = "Hashnote Short-Duration Yield Coin";
    string public symbol = "USYC";
    uint8 public decimals = 6;
    
    address public usdcToken;
    uint256 public constant APY_BPS = 500; // 5.0% APY
    uint256 public initialExchangeRate = 1e6; // 1 USYC = 1 USDC initially
    uint256 public deploymentTime;
    
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    
    constructor(address _usdc) {
        usdcToken = _usdc;
        deploymentTime = block.timestamp;
    }
    
    // Exchange rate increases by 5% per year
    function getExchangeRate() public view returns (uint256) {
        uint256 timePassed = block.timestamp - deploymentTime;
        // 5% interest compound simulated linearly: rate = 1e6 + (1e6 * 5% * timePassed / 365 days)
        return initialExchangeRate + (initialExchangeRate * APY_BPS * timePassed) / (10000 * 365 days);
    }
    
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        uint256 rate = getExchangeRate();
        shares = (assets * 1e6) / rate;
        
        require(IERC20(usdcToken).transferFrom(msg.sender, address(this), assets), "USDC transfer failed");
        
        _totalSupply += shares;
        _balances[receiver] += shares;
        
        emit Transfer(address(0), receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }
    
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(_balances[owner] >= shares, "Insufficient shares balance");
        
        uint256 rate = getExchangeRate();
        assets = (shares * rate) / 1e6;
        
        _totalSupply -= shares;
        _balances[owner] -= shares;
        
        require(IERC20(usdcToken).transfer(receiver, assets), "USDC transfer failed");
        
        emit Transfer(owner, address(0), shares);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
    
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }
}
