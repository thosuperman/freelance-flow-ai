// Runs before each integration test file (before any app module is imported).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://freelanceflow:freelanceflow@localhost:54329/freelanceflow_test";
process.env.APP_ENCRYPTION_KEY = "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMzJieXQ=";
process.env.PAYPAL_MODE = "mock";
process.env.AI_PROVIDER = "simulated";
process.env.APP_URL = "http://localhost:3000";
