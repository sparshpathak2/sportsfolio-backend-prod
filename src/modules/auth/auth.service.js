import prisma from "../../infra/prisma.js";
import { generateOtp } from "../../utils/generateCode.utils.js";
import { sendOtpSms } from "../../infra/sms.provider.js";

export async function requestOtpService(phone) {
    const code = generateOtp();

    await prisma.otp.create({
        data: {
            phone,
            code,
            expiresAt: otpExpiry(),
        },
    });

    // 🔔 Send SMS
    await sendOtpSms(phone, code);
}

export async function verifyOtpService(phone, code) {
    const otp = await prisma.otp.findFirst({
        where: {
            phone,
            code,
            verified: false,
            expiresAt: { gt: new Date() },
        },
    });

    if (!otp) {
        throw new Error("Invalid or expired OTP");
    }

    // Mark OTP as used
    await prisma.otp.update({
        where: { id: otp.id },
        data: { verified: true },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
        where: { phone },
        include: { profiles: true },
    });

    if (!user) {
        user = await prisma.user.create({
            data: { phone },
        });
    }

    return user;
}
