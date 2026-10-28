// Unit/component regressions must never read developer/production credentials.
// Integration requiring a real database has its own opt-in isolated configuration.
process.env.NEXT_PUBLIC_SERVER_URL = 'https://store.example'
process.env.PAYLOAD_PUBLIC_SERVER_URL = 'https://store.example'
process.env.PAYLOAD_SECRET = 'isolated-unit-test-secret'
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/nski_unit_tests'
process.env.RESEND_API_KEY = ''
process.env.R2_BUCKET = ''
process.env.R2_RECEIPTS_BUCKET = ''
