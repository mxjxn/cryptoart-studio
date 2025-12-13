/**
 * Script to compose a cast announcing the cancellation of listing 6
 * 
 * Usage: Copy the code below and run it in a context where sdk is available
 * (e.g., in the browser console on cryptoart.social, or in a Farcaster client)
 */

// Cast text for canceling listing 6
const castText = `⚠️ Admin Cancellation: Listing #6 "251128A"

This auction is being cancelled due to a contract configuration issue that prevents proper finalization.

Active bidder will receive a full refund.

The issue has been identified and fixed for future listings. We apologize for any inconvenience.

cryptoart.social/listing/6`;

// If running in a context with sdk available:
// await sdk.actions.composeCast({
//   text: castText,
//   embeds: ["https://cryptoart.social/listing/6"]
// });

console.log("Cast text to send:");
console.log("=".repeat(60));
console.log(castText);
console.log("=".repeat(60));
console.log("\nTo send this cast, use:");
console.log(`
await sdk.actions.composeCast({
  text: \`${castText.replace(/`/g, '\\`')}\`,
  embeds: ["https://cryptoart.social/listing/6"]
});
`);

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { castText };
}

