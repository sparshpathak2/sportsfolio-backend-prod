import crypto from "crypto";

export const generateCode = () => {
    return crypto.randomBytes(6).toString("hex"); // 12 chars
};