import axios from "axios";

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

    const response = await axios.get(`${SMS_API_BASE_URL}?${params.toString()}`);
    const body = String(response.data).trim();

    // Log the vendor response only, never the OTP or API key
    console.log(`📲 SMS provider response for ${contact}:`, body);

    if (body.startsWith("ERR:")) {
        throw new Error(`SMS_SEND_FAILED: ${body}`);
    }

    return { success: true, raw: body };
};