pragma solidity >=0.6.6;

import "../../openzeppelin-contracts-upgradeable/contracts/math/SafeMathUpgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/IERC20Upgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20BurnableUpgradeable.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/token/ERC20/SafeERC20Upgradeable.sol";

contract TestToken is ERC20BurnableUpgradeable {

    constructor(string memory _name, string memory _symbol)  public {
        __ERC20_init(_name, _symbol);
        _mint(msg.sender, 100000000 * (10 ** uint(decimals())));
    }

}