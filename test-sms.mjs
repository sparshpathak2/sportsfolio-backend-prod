import { sendOtpSms } from "./src/lib/smsProvider.js";

const phone = process.argv[2];
if (!phone) {
    console.error("Usage: node --env-file=.env test-sms.mjs <phone>");
    process.exit(1);
}

try {
    const result = await sendOtpSms(phone, "123456");
    console.log("OK:", result);
} catch (err) {
    console.error("FAILED:", err.message);
}