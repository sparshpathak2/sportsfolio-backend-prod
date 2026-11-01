import axios from "axios";
import { logger, maskPhone } from "./logger.js";

const SMS_API_BASE_URL = "https://sms.hitechsms.com/app/smsapi/index.php";

const toLocalMobileNumber = (phone) => {
    const digitsOnly = String(phone).replace(/\D/g, "");
    if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
        return digitsOnly.slice(2);
    }
    if (digitsOnly.length === 10) {
        return digitsOnly;
    }
    throw new Error(`Cannot normalize phone number for SMS: ${phone}`);
};

export const sendOtpSms = async (phone, otp) => {
    const SMS_API_KEY = process.env.SMS_API_KEY;
    const SMS_ROUTE_ID = process.env.SMS_ROUTE_ID;
    const SMS_SENDER_ID = process.env.SMS_SENDER_ID;
    const SMS_TEMPLATE_ID = process.env.SMS_TEMPLATE_ID;

    if (!SMS_API_KEY || !SMS_ROUTE_ID || !SMS_SENDER_ID || !SMS_TEMPLATE_ID) {
        throw new Error(
            "SMS_API_KEY, SMS_ROUTE_ID, SMS_SENDER_ID, or SMS_TEMPLATE_ID not configured"
        );
    }

    const contact = toLocalMobileNumber(phone);

    // Must match the approved DLT template word for word:
    // "{#num#} is your 3BOXLLP verification code. Valid for 10 minutes.
    //  Do not share this code with anyone. - 3BOXLLP"
    const message = `${otp} is your 3BOXLLP verification code. Valid for 10 minutes. Do not share this code with anyone. - 3BOXLLP`;

    const params = new URLSearchParams({
        key: SMS_API_KEY,
        campaign: "0",
        routeid: SMS_ROUTE_ID,
        type: "text",
        contacts: contact,
        senderid: SMS_SENDER_ID,
        msg: message,
        template_id: SMS_TEMPLATE_ID,
    });

    let response;
    try {
        response = await axios.get(`${SMS_API_BASE_URL}?${params.toString()}`, {
            timeout: 10000,
        });
    } catch (error) {
        // Axios errors carry the full request URL (API key + OTP). Never let them escape.
        const reason = error.response ? `HTTP ${error.response.status}` : error.code || "UNKNOWN";
        throw new Error(`SMS_REQUEST_FAILED: ${reason}`);
    }

    const body = String(response.data).trim();

    // Log the vendor response only, never the OTP or API key; phone is masked
    logger.info({ phone: maskPhone(contact), providerResponse: body }, "SMS provider response");

    if (body.startsWith("ERR:")) {
        throw new Error(`SMS_SEND_FAILED: ${body}`);
    }

    return { success: true, raw: body };
};