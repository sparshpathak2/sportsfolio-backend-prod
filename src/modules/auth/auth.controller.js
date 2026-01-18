import prisma from "../../lib/prisma.js";
import { generateOtp, hashOtp } from "../../utils/otp.utils.js";
// import { requestOtpService, verifyOtpService } from "./auth.service.js";

export const requestOtp = async (req, res) => {
    const { phone } = req.body

    // console.log("req.body at requestOtp:", req.body)

    if (!phone) {
        return res.status(400).json({ message: "Phone is required" })
    }

    let user = await prisma.user.findUnique({
        where: { phone }
    })

    if (!user) {
        user = await prisma.user.create({
            data: { phone }
        })
    }

    const otp = generateOtp()
    const codeHash = hashOtp(otp)

    await prisma.oTP.create({
        data: {
            phone: phone,                 // required by schema
            code: otp,                    // store OTP
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
            verified: false
        }
    });

    // 🚧 DEV ONLY
    // if (process.env.NODE_ENV !== "production") {
    return res.json({
        success: true,
        otp,
        expiresIn: 300
    })
    // }

    // 🔥 SMS provider will go here later
    // return res.json({ success: true })
}

// export const verifyOtp = async (req, res) => {
//     try {
//         const { phone, otp } = req.body;

//         if (!phone || !otp) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Phone and OTP required",
//             });
//         }

//         // Find latest OTP for this phone that is not expired
//         const otpRecord = await prisma.oTP.findFirst({
//             where: {
//                 phone,
//                 verified: false,
//                 expiresAt: { gt: new Date() },
//             },
//             orderBy: { createdAt: "desc" },
//         });

//         if (!otpRecord) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid or expired OTP",
//             });
//         }

//         const isValid = otpRecord.code === otp; // compare directly

//         if (!isValid) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid OTP",
//             });
//         }

//         // Mark OTP verified
//         await prisma.oTP.update({
//             where: { id: otpRecord.id },
//             data: { verified: true },
//         });

//         // Optionally return user info
//         const user = await prisma.user.findUnique({ where: { phone } });

//         return res.json({
//             success: true,
//             user: {
//                 id: user.id,
//                 phone: user.phone,
//             },
//         });
//     } catch (error) {
//         console.error("Verify OTP error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "OTP verification failed",
//         });
//     }
// };

export const verifyOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                message: "Phone and OTP required",
            });
        }

        // 1️⃣ Find valid OTP
        const otpRecord = await prisma.oTP.findFirst({
            where: {
                phone,
                verified: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });

        if (!otpRecord || otpRecord.code !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            });
        }

        // 2️⃣ Fetch user
        const user = await prisma.user.findUnique({
            where: { phone },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // 3️⃣ Create session (7 days example)
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // 4️⃣ Mark OTP verified & invalidate others
        await prisma.oTP.updateMany({
            where: { phone, verified: false },
            data: { verified: true },
        });

        // 5️⃣ (Optional) Cookie for web
        res.cookie("sessionId", session.id, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            // secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // 6️⃣ Return response (Flutter-friendly)
        return res.json({
            success: true,
            sessionId: session.id,
            user
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).json({
            success: false,
            message: "OTP verification failed",
        });
    }
};

export const verifySession = async (req, res) => {
    try {
        const sessionId = req.headers["x-session-id"] || req.cookies?.sessionId;

        // console.log("sessionId at verify session:", sessionId)

        if (!sessionId) {
            return res.json({ valid: false });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: true },
        });

        if (!session || session.expiresAt < new Date()) {
            return res.json({ valid: false });
        }

        return res.json({
            valid: true,
            user: {
                id: session.user.id,
                phone: session.user.phone,
            },
        });
    } catch (error) {
        console.error("VerifySession error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
