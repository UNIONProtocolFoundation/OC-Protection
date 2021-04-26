pragma solidity >=0.6.12;

import "../../openzeppelin-contracts-upgradeable/contracts/math/SafeMathUpgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/IERC20Upgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/SafeERC20Upgradeable.sol";
import "../interfaces/IERC20Token.sol";


contract PoolUpgradable is ERC20Upgradeable{

    using SafeERC20Upgradeable for IERC20Token;

    IERC20Token public basicToken;

    uint256 public totalCap;

    event Deposit(address indexed writer, uint256 amount);
    event Withdraw(address indexed writer, uint256 amount);

    function __Pool_init(address _basicToken, string memory _description) internal initializer {
        __ERC20_init(_description, "pUNN");
        __Pool_init_unchained(_basicToken);
    }

    function __Pool_init_unchained(address _basicToken) internal initializer {
        basicToken = IERC20Token(_basicToken);
    }

    
    /**
    * deposit ERC20 tokens function, assigns Liquidity tokens to provided address.
    * @param _amount - amount to deposit
    * @param _to - address to assign liquidity tokens to
    */
    function depositTo(
        uint256 _amount,
        address _to
    ) external virtual {
        _deposit(_amount, _to);
    }

    /**
    * deposit ERC20 tokens function, assigns Liquidity tokens to msg.sender address.
    * @param _amount - amount to deposit
    */
    function deposit (
        uint256 _amount
    ) external virtual{
        _deposit(_amount, msg.sender);
    }

    
    /**
    * converts spefied amount of Liquidity tokens to Basic Token and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of 
    * Liquidity tokens. Resulted amount of tokens are transferred to msg.sender
    * @param _amount - amount of liquidity tokens to exchange to Basic token.
     */
    function withdraw(uint256 _amount) external virtual{
        _withdraw(_amount, msg.sender);
    }

    /**
    * converts spefied amount of Liquidity tokens to Basic Token and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of Liquidity tokens. 
    * Resulted amount of tokens are transferred to specified address
    * @param _amount - amount of liquidity tokens to exchange to Basic token.
    * @param _to - address to send resulted amount of tokens to
     */
    function withdrawTo(
        uint256 _amount,
        address _to
    ) external virtual {
        _withdraw(_amount,_to);
    }

    function _deposit(uint256 amount, address to) internal virtual {
        _beforeDeposit(amount, msg.sender, to);
        basicToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 mintAmount = totalCap != 0 ? amount.mul(totalSupply()).div(totalCap) : amount.mul(10**uint256(decimals())).div(10**uint256(basicToken.decimals()));
        _mint(to, mintAmount);
        totalCap = totalCap.add(amount);
        emit Deposit(to, amount);
        _afterDeposit(amount, mintAmount,  msg.sender, to);
    }

    function _withdraw(uint256 amountLiquidity, address to) internal virtual {
        _beforeWithdraw(amountLiquidity, msg.sender, to);
        uint256 revenue = totalSupply() != 0 ? amountLiquidity.mul(totalCap).div(totalSupply()) : amountLiquidity;
        require(revenue <= basicToken.balanceOf(address(this)), "Not enough Basic Token tokens on the balance to withdraw");
        totalCap = totalCap.sub(revenue);
        _burn(msg.sender, amountLiquidity);
        basicToken.safeTransfer(to, revenue);
        emit Withdraw(msg.sender, revenue);
        _afterWithdraw(revenue, msg.sender, to);
    }

    function _beforeDeposit(uint256 amountTokenSent, address sender, address holder) internal virtual {}
    function _afterDeposit(uint256 amountTokenSent, uint256 amountLiquidityGot, address sender, address holder) internal virtual {}
    function _beforeWithdraw(uint256 amountLiquidity, address holder, address receiver) internal virtual {}
    function _afterWithdraw(uint256 amountTokenReceived, address holder, address receiver) internal virtual {}

    uint256[10] private __gap;
}
