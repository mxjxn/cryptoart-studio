// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title IParty
 * @notice Minimal interface for Party Protocol governance
 * @dev Based on Party Protocol's Party.sol contract
 */
interface IParty {
    /// @notice Governance proposal states
    enum ProposalStatus {
        Invalid,
        Voting,
        Defeated,
        Passed,
        Ready,
        InProgress,
        Complete,
        Cancelled
    }

    /// @notice A governance proposal
    struct Proposal {
        uint40 maxExecutableTime;
        uint40 cancelDelay;
        bytes proposalData;
    }

    /// @notice Info about a proposal's current state
    struct ProposalStateValues {
        uint40 proposedTime;
        uint40 passedTime;
        uint40 executedTime;
        uint40 completedTime;
        uint96 votes;
        uint96 totalVotingPower;
        address proposer;
    }

    /**
     * @notice Create a new proposal
     * @param proposal The proposal to create
     * @param latestSnapIndex The latest voting power snapshot index
     * @return proposalId The ID of the created proposal
     */
    function propose(
        Proposal calldata proposal,
        uint256 latestSnapIndex
    ) external returns (uint256 proposalId);

    /**
     * @notice Accept a proposal (vote for it)
     * @param proposalId The ID of the proposal
     * @param snapIndex The voting power snapshot index
     * @return totalVotes The total votes after accepting
     */
    function accept(
        uint256 proposalId,
        uint256 snapIndex
    ) external returns (uint256 totalVotes);

    /**
     * @notice Execute a passed proposal
     * @param proposalId The ID of the proposal
     * @param proposal The proposal data
     * @param preciousTokens Precious tokens held by the party
     * @param preciousTokenIds Precious token IDs
     * @param progressData Progress data for multi-step execution
     * @param extraData Extra data for execution
     */
    function execute(
        uint256 proposalId,
        Proposal calldata proposal,
        IERC721[] calldata preciousTokens,
        uint256[] calldata preciousTokenIds,
        bytes calldata progressData,
        bytes calldata extraData
    ) external;

    /**
     * @notice Get the status of a proposal
     * @param proposalId The ID of the proposal
     * @return status The current status
     */
    function getProposalStateInfo(
        uint256 proposalId
    ) external view returns (ProposalStatus status, ProposalStateValues memory);

    /**
     * @notice Get the voting power of an address
     * @param voter The address to check
     * @param timestamp The timestamp to check at
     * @param snapIndex The snapshot index
     * @return votingPower The voting power
     */
    function getVotingPowerAt(
        address voter,
        uint40 timestamp,
        uint256 snapIndex
    ) external view returns (uint96 votingPower);

    /**
     * @notice Check if an address is a host
     * @param host The address to check
     * @return True if the address is a host
     */
    function isHost(address host) external view returns (bool);
}

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
}
