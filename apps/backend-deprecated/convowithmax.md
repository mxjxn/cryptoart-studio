e
CreateListing
auctionhouse-contracts/src/libs/MarketplaceLib.sol at main · mxjxn/auctionhouse-contracts
github.com
auctionhouse-contracts/src/libs/MarketplaceLib.sol at main · mxjxn/auctionhouse-contracts
i was looking for this:

https://github.com/mxjxn/auctionhouse-contracts/blob/main/src/libs/MarketplaceLib.sol#L35
dutch avatar
You
·
22h
The solidity contract emits something to trigger the auction,
Trackable,
Which should give the actual address you're looking for
Trackable?
yea you said you didnt understand it lol
mx avatar
mxjxn
·
22h
just a file that defines the signature of every read and write method and events, so js libraries can know what to expect
Isn't this literally the abi?
The solidity contract emits something to trigger the auction,
Trackable,
Which should give the actual address you're looking for
But you're trying to use the one on chain or a new contract is okay )
thats the auctionhouse
OpenGraph image
basescan.org
https://basescan.org/address/0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9
so you can technically just add it to the abi... could work idk
just a file that defines the signature of every read and write method and events, so js libraries can know what to expect
I think really I'll only need the contract address 😂

Abi would be nice if I actually understood them
Uhhh yea fill me in on the details on the contract addresse and what your trying to catch and I'll see if I can find it
probably generating an event so a page gets updated
just listening
no youve got it
Unless I'm missing something
Only rpc calls for free
A listener from a server / indexing shouldn't cost on chain txs
yea basically... let me find it
So it's already on chain and broadcasting events I just have to catch them ?
because theres a royalty registry and i dont know if theres a testnet one
That's the fun part for me
the minor issue is I'm testing in prod
I totally think I can do that rather easily lol
Okey dokey,

I generally build those things on Linux,

Node, run on a server
so i realized i would have to roll my own
so the issue is that the solidity auctionhouse contract generates the new-auction event from a  solidity library, not from within its own contract, so the CreateAuction event isnt included in the contract ABI which tells ponder what events to listen to
Ponder
ponder.sh
Ponder
yeah basically. I remember something unusual holding me up though. Oh yeah i was using ponder.sh and it had limitations
mx avatar
mxjxn
·
23h
Need to build an event indexer for the backend
In dummy.

Thing that tracks on chain events and stores them on the server in a DB for faster retrieval client side ?
mx avatar
mxjxn
·
23h
I deployed that auctionhouse... the problem thats held me back is indexing the auctions.
Okay I'll take a look, I'm at work right now and not entirely sure I understand what you mean but if you explain it a little heavier I'm usually kinda okay at figuring things out.

I just don't know nouns
mx avatar
mxjxn
·
23h
hell yeah man. do you want to take a peek at https://github.com/mxjxn/such.market and tell me what you think? Its meticulously vibecoded lol
Yea I'll check it out this evening and share you my pumpkin one, mine is a simple pinata system, the leaderboard loads in the pumpkin app after maybe 5 seconds, no caching
lmk what you think about those
GitHub - mxjxn/auctionhouse-contracts: A fork of @manifoldxyz auctionhouse contracts in a Foundry project, for cryptoart.social
github.com
GitHub - mxjxn/auctionhouse-contracts: A fork of @manifoldxyz auctionhouse contracts in a Foundry project, for cryptoart.social
https://github.com/mxjxn/auctionhouse-contracts
Need to build an event indexer for the backend
I deployed that auctionhouse... the problem thats held me back is indexing the auctions.
oh you know what i do need your help with
where Im at with it is testing seaport contracts
the meat of what it has is a really good fallback system for loading NFT data and caching vs storing it. starts with an api with onchain fallbacks. it keeps certain ones in cache for quicker loading.
GitHub - mxjxn/such.market: nft marketplace mini-app
github.com
GitHub - mxjxn/such.market: nft marketplace mini-app
hell yeah man. do you want to take a peek at https://github.com/mxjxn/such.market and tell me what you think? Its meticulously vibecoded lol
