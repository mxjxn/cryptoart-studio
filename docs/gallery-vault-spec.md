# Gallery Vault & Governance Spec

## Overview

SuchGallery operates in two layers:

1. **Curatorial surface** (off-chain) — mutable exhibitions, external art, text, images. See [gallery-curation-api.md](./gallery-curation-api.md).
2. **Permanent vault** (on-chain, ERC-6551 TBA) — the gallery's owned collection. Art deposited into the TBA belongs to the gallery entity itself.

The vault is what makes ERC-6551 relevant. Without it, TBA is overhead. With it, the gallery becomes a living entity that can own, hold, and trade art independently of any individual.

## Ownership Modes

Every gallery has one of two ownership modes, determined at mint or transfer:

### Solo Mode (default)

- Gallery NFT owned by an EOA
- Owner has full control: curate exhibitions, deposit/withdraw from vault, sell vault items
- No governance, no voting, no ERC-20
- `registerDeposit` fires when art enters the TBA
- Owner can withdraw via `TBA.execute()` directly

### Collective Mode

- Gallery NFT owned by a `GalleryDAO` contract
- `GalleryDAO` holds the NFT, so the TBA belongs to the DAO
- Members hold ERC-20 governance tokens for that specific gallery
- Vault operations (withdraw, sell, buy) require governance
- Exhibition curation can be delegated to a single curator or rotated

## GalleryDAO Contract

Lightweight governor — one per collective gallery, deployed on demand.

```
contract GalleryDAO {
    // ERC-20 governance tokens for this gallery
    // Fixed supply, distributed at creation
    string public name;       // "SuchGallery #7 Governance"
    string public symbol;     // "SG7"
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    // The gallery NFT this DAO controls
    uint256 public galleryTokenId;
    ISuchGallery public gallery;

    // Proposals
    struct Proposal {
        address target;       // contract to call (marketplace, TBA, etc)
        bytes callData;       // encoded function call
        uint256 value;        // ETH to send
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    // Thresholds
    uint256 public proposalThreshold;  // min tokens to propose (e.g., 1%)
    uint256 public quorum;             // min participation (e.g., 10%)
    uint256 public votingPeriod;       // e.g., 3 days

    // Curator (optional delegate for exhibition curation)
    address public curator;           // can be rotated by vote
    bool public curatorAutoRotate;    // rotate curator every N exhibitions
}
```

### Proposal Types

| Action | Target | Description |
|--------|--------|-------------|
| Withdraw from vault | TBA | Move specific art out of permanent collection |
| List on marketplace | Marketplace | Sell vault item through auction house |
| Buy for vault | Marketplace | Use DAO treasury to buy art for the vault |
| Set curator | GalleryDAO | Change the exhibition curator |
| Transfer treasury | any | Move ETH/tokens from DAO treasury |

### Voting

- 1 token = 1 vote
- Simple majority with quorum
- 3-day voting period (configurable)
- No delegation — holders vote directly
- Proposal creator must hold `proposalThreshold` tokens

## GalleryToken (ERC-20)

Per-gallery governance token. Not transferable by default (soul-bound to founders) unless the DAO votes to enable transfers.

```
contract GalleryToken is ERC20 {
    bool public transfersEnabled;  // false by default, enable via DAO vote
    uint256 public maxSupply;      // fixed at creation

    function transfer(address to, uint256 amount) override {
        require(transfersEnabled, "Transfers disabled");
        super.transfer(to, amount);
    }
}
```

**Why not transferable by default?** Prevents speculative buying of governance power. The DAO is a curatorial collective, not a tradeable asset. Can be enabled later by vote if the members want it.

## Collective Formation Flow

1. **Initiator** calls `SuchGallery.createCollectiveGallery(members[], shares[], name)`
2. Contract mints gallery NFT to a new `GalleryDAO`
3. GalleryDAO mints governance tokens to `members` proportional to `shares`
4. Members vote on proposals to operate the vault

```typescript
// Example: 3 artists form a collective
const members = [alice, bob, charlie];
const shares = [40, 30, 30]; // percentage-based
const name = "Light Collective";

// Deploys GalleryDAO, mints gallery NFT, distributes tokens
// Alice gets 40 governance tokens, Bob 30, Charlie 30
```

## Solo → Collective Transition

An existing solo gallery can transition to collective mode:

1. Owner calls ` SuchGallery.transitionToCollective(members[], shares[])`
2. Contract deploys a `GalleryDAO`
3. Owner transfers gallery NFT to the DAO
4. Governance tokens minted to members (owner's share specified in call)
5. **Irreversible** — once collective, can't go back to solo

## Contract Changes to SuchGallery.sol

Additions to the existing contract from PR #132:

```solidity
// New state
mapping(uint256 => address) public galleryDAO;   // tokenId => DAO address (address(0) if solo)
mapping(uint256 => bool) public isCollective;     // tokenId => collective mode

// New functions
function createCollectiveGallery(
    address[] calldata members,
    uint256[] calldata shares,
    string calldata name
) external returns (uint256 tokenId);

function transitionToCollective(
    uint256 tokenId,
    address[] calldata members,
    uint256[] calldata shares
) external onlyGalleryOwner(tokenId);

function isCollectiveGallery(uint256 tokenId) external view returns (bool);
function getGalleryDAO(uint256 tokenId) external view returns (address);
```

**Storage layout is purely additive** — no existing slots modified.

## Security Considerations

- **TBA execution** remains the same — the DAO is just another owner. It calls `TBA.execute()` via proposal execution.
- **Emergency withdraw** — if governance is deadlocked, a supermajority (66%) vote can dissolve the DAO and return the gallery NFT to proportional token holders for liquidation.
- **Curator powers are limited** — curator can only modify off-chain exhibition data. Vault operations always require governance.
- **No time locks** — for a 30-edition collection with small collectives, time locks add complexity without meaningful security benefit. Quorum + voting period is sufficient.

## Future Extensions (out of scope for v1)

- **Fractional vault** — tokenize individual vault items so members can exit without dissolving the whole gallery
- **Exhibition proposals** — vote on upcoming exhibition themes (requires curator to implement)
- **Revenue sharing** — auto-distribute marketplace sale proceeds to token holders
- **Cross-gallery loans** — one gallery loans vault art to another for an exhibition
