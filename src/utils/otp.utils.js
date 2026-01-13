import crypto from "crypto";

export function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function otpExpiry(minutes = 5) {
    return new Date(Date.now() + minutes * 60 * 1000);
}

export const hashOtp = (otp) => {
    return crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex");
};