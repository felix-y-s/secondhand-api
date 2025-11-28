const fs = require('fs');
const dotenv = require('dotenv');

console.log('=== ConfigModule loadEnvFile 로직 재현 ===');
const envFilePaths = ['.env.development', '.env'];
let config = {};

for (const envFilePath of envFilePaths) {
  if (fs.existsSync(envFilePath)) {
    const parsed = dotenv.parse(fs.readFileSync(envFilePath));
    console.log(`${envFilePath} JWT_SECRET:`, parsed.JWT_SECRET);
    config = Object.assign(parsed, config);
    console.log('After Object.assign(parsed, config):', config.JWT_SECRET);
  }
}

console.log('\n최종 결과:', config.JWT_SECRET);
