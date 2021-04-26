pragma solidity >=0.6.6;


import "../datatypes/StructuredLinkedList.sol";
import "../../openzeppelin-contracts-upgradeable/contracts/math/SafeMathUpgradeable.sol";
contract TestList {

    using SafeMathUpgradeable for uint256;
    using StructuredLinkedList for StructuredLinkedList.List;  

    StructuredLinkedList.List public mcrPendingsList;
    uint256 public totalMcrPending;
    uint256 public mcr;
    uint64 public  mcrUpdatedBlockNumber;

    
    event TestEvent(uint256 node, uint256 mcr, uint64 blockNumber, string data);
    event Size(uint256 size, string data);
    event MCRUpdated(uint256 oldMCR, uint64 oldblockNumber, uint256 newMCR, uint64 newblockNumber);

    function updateMCR(uint256 newMCR, uint256 newMCRBlockNumber, uint256 mcrIncrement) public {

        //unload mcrPendings
        uint sizeOf =  mcrPendingsList.sizeOf();//loop over initial size!
        for (uint i=0;i<sizeOf;i++){
            uint256 item = mcrPendingsList.head();
            uint64 blockNumber = uint64(item & 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF);
            if(blockNumber <= newMCRBlockNumber){
                //delete item, subtract from totalMCRPending;
                uint256 mcrPending = item >> 64;
                totalMcrPending = totalMcrPending.sub(mcrPending);
                mcrPendingsList.remove(item);
                emit TestEvent(item, mcrPending, blockNumber, "Removed");
            }else {
                emit TestEvent(item, 0, blockNumber, "NotRemoved");
                break;
            }
        }

        emit Size(mcrPendingsList.sizeOf(),"after removal");

        if(newMCRBlockNumber > mcrUpdatedBlockNumber){
          emit MCRUpdated(mcr,mcrUpdatedBlockNumber,newMCR,uint64(newMCRBlockNumber));
          mcrUpdatedBlockNumber = uint64(newMCRBlockNumber);
          mcr = newMCR;
        }

        //add new mcrPending
        if(mcrIncrement > 0){
            uint256 item = (mcrIncrement<<64).add(block.number & 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF);
            mcrPendingsList.pushBack(item);
            totalMcrPending = totalMcrPending.add(mcrIncrement);
            emit TestEvent(item, mcrIncrement, uint64(block.number), "Added");
        }

        emit Size(mcrPendingsList.sizeOf(),"finished");
    }


    function sizeOf() public view returns (uint256){
      return mcrPendingsList.sizeOf();
    }

    function head() public view returns(uint256){
      return mcrPendingsList.head();
    }

    function getNextNode(uint256 node) public view returns (bool, uint256){
      return mcrPendingsList.getNextNode(node);
    }

    
        
    

}