// End-to-end tests with authentication
import { prisma } from "./src/config/Prisma";

// Base URL for the API
const baseUrl = "http://localhost:5000";

// Helper to register a test user
async function registerUser(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 201) {
    const body = await res.json();
    throw new Error(`User registration failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return true;
}

// Helper to login and obtain an access token
async function loginUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    const body = await res.json();
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(body)}`);
  }
  const { accessToken } = await res.json() as { accessToken: string };
  return accessToken;
}

async function runTests() {
  console.log("==================================================");
  console.log("       LINKVAULT END-TO-END ENDPOINT TESTS        ");
  console.log("==================================================\n");

// Using global baseUrl defined at top
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.log(`❌ [FAIL] ${testName}`, detail || "");
    }
  }

  // --------------------------------------------------
  // Register and login a test user to obtain JWT token
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "Password123!";
  await registerUser(testEmail, testPassword);
  const accessToken = await loginUser(testEmail, testPassword);
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // --- Test 1: GET /health ---
  try {
    const res = await fetch(`${baseUrl}/health`);
    const body = (await res.json()) as any;
    assert(
      res.status === 200 && body.status === "ok",
      "GET /health returns 200 OK with status: ok",
      body
    );
  } catch (err) {
    assert(false, "GET /health server reachable", err);
  }

  // --- Test 2: POST /api/links/shorten (Validation Failure - Invalid URL) ---
  try {
    const res = await fetch(`${baseUrl}/api/links/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ originalUrl: "not-a-valid-url" }),
    });
    const body = (await res.json()) as any;
    assert(
      res.status === 400 && body.error === "Validation failed",
      "POST /api/links/shorten with invalid URL returns 400 Bad Request",
      body
    );
  } catch (err) {
    assert(false, "POST /api/links/shorten validation test", err);
  }

  // --- Test 3: POST /api/links/shorten (Valid URL, Auto-generated Code) ---
  let generatedCode = "";
  try {
    const res = await fetch(`${baseUrl}/api/links/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ originalUrl: "https://news.ycombinator.com" }),
    });
    const body = (await res.json()) as any;
    generatedCode = body.shortCode;
    assert(
      res.status === 201 &&
      typeof body.shortCode === "string" &&
      body.shortCode.length === 7 &&
      body.shortUrl.includes(body.shortCode) &&
      body.originalUrl === "https://news.ycombinator.com",
      "POST /api/links/shorten returns 201 Created with 7-char shortCode and shortUrl",
      body
    );
  } catch (err) {
    assert(false, "POST /api/links/shorten auto-generate test", err);
  }

  // --- Test 4: POST /api/links/shorten (Custom Alias) ---
  const customAlias = `test-${Date.now().toString().slice(-6)}`;
  try {
    const res = await fetch(`${baseUrl}/api/links/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        originalUrl: "https://github.com",
        customAlias: customAlias,
      }),
    });
    const body = (await res.json()) as any;
    assert(
      res.status === 201 && body.shortCode === customAlias,
      `POST /api/links/shorten with custom alias '${customAlias}' returns 201 Created`,
      body
    );
  } catch (err) {
    assert(false, "POST /api/links/shorten custom alias test", err);
  }

  // --- Test 5: POST /api/links/shorten (Duplicate Custom Alias - 409 Conflict) ---
  try {
    const res = await fetch(`${baseUrl}/api/links/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        originalUrl: "https://gitlab.com",
        customAlias: customAlias,
      }),
    });
    const body = (await res.json()) as any;
    assert(
      res.status === 409 && body.error?.includes("already in use"),
      "POST /api/links/shorten with duplicate alias returns 409 Conflict",
      body
    );
  } catch (err) {
    assert(false, "POST /api/links/shorten duplicate alias test", err);
  }

  // --- Test 6: GET /:shortCode (Redirect for Auto-generated Code) ---
  try {
    const res = await fetch(`${baseUrl}/${generatedCode}`, {
      redirect: "manual",
    });
    const location = res.headers.get("location");
    assert(
      res.status === 302 && location === "https://news.ycombinator.com",
      `GET /${generatedCode} returns 302 Redirect pointing to original URL`,
      { status: res.status, location }
    );
  } catch (err) {
    assert(false, "GET /:shortCode redirect test", err);
  }

  // --- Test 7: GET /:shortCode (Redirect for Custom Alias) ---
  try {
    const res = await fetch(`${baseUrl}/${customAlias}`, {
      redirect: "manual",
    });
    const location = res.headers.get("location");
    assert(
      res.status === 302 && location === "https://github.com",
      `GET /${customAlias} returns 302 Redirect pointing to https://github.com`,
      { status: res.status, location }
    );
  } catch (err) {
    assert(false, "GET /:customAlias redirect test", err);
  }

  // --- Test 8: GET /:shortCode (Non-existent Code - 404 Not Found) ---
  try {
    const res = await fetch(`${baseUrl}/non-existent-code-xyz`);
    const body = (await res.json()) as any;
    assert(
      res.status === 404 && body.error?.includes("not found"),
      "GET /non-existent-code-xyz returns 404 Not Found",
      body
    );
  } catch (err) {
    assert(false, "GET /:shortCode 404 test", err);
  }

  // --- Test 9: Database Click Analytics Verification ---
  try {
    await new Promise((r) => setTimeout(r, 600));
    const linkWithClicks = await prisma.link.findUnique({
      where: { shortCode: customAlias },
      include: { clicks: true },
    });
    assert(
      linkWithClicks !== null && linkWithClicks.clicks.length >= 1,
      `Database Click Logging: Clicks table has ${linkWithClicks?.clicks.length || 0} click record(s) for '${customAlias}'`,
      linkWithClicks?.clicks[0]
    );
  } catch (err) {
    assert(false, "Database Click Logging verification", err);
  }

  console.log("\n==================================================");
  console.log(`   TEST RESULTS: ${passedCount} / ${totalCount} PASSED`);
  console.log("==================================================");

  await prisma.$disconnect();
  process.exit(passedCount === totalCount ? 0 : 1);
}

runTests();
