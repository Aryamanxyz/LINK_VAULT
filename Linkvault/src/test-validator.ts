import { shortenUrlSchema } from "./validators/shortenUrl.validator";

console.log("=== TEST 4: Valid Input Test ===");
const validResult = shortenUrlSchema.safeParse({
  originalUrl: "https://example.com",
  customAlias: "my-link"
});
console.log("success:", validResult.success);
if (validResult.success) {
  console.log("data:", JSON.stringify(validResult.data, null, 2));
}

console.log("\n=== TEST 5: Invalid Input Test ===");
const invalidResult = shortenUrlSchema.safeParse({
  originalUrl: "not-a-valid-url",
  customAlias: "a"
});
console.log("success:", invalidResult.success);
if (!invalidResult.success) {
  console.log("issues:", JSON.stringify(invalidResult.error.issues, null, 2));
}
