import { generateUniqueShortCode } from "./services/shortCode.service";

(async () => {
  const code = await generateUniqueShortCode();
  console.log("Generated code:", code);
})();
