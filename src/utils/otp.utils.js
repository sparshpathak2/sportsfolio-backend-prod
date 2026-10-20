import crypto from "crypto";

export function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

export function otpExpiry(minutes = 10) {
    return new Date(Date.now() + minutes * 60 * 1000);
}

export const hashOtp = (otp) => {
    return crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex");
};