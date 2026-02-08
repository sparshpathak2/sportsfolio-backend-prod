import prisma from "../../lib/prisma.js";
import { generateOtp, hashOtp } from "../../utils/otp.utils.js";
import axios from "axios";
import { FIREBASE_API_KEY, verifyIdToken } from "../../lib/firebase.js";
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

    try {
        // Send OTP using Firebase Auth REST API
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_API_KEY}`,
            {
                phoneNumber: phone,
                // recaptchaToken: "optional" // Add if needed for production
            }
        );

        const sessionInfo = response.data.sessionInfo;

        // Store sessionInfo in database
        await prisma.oTP.create({
            data: {
                phone: phone,
                sessionInfo: sessionInfo,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
                verified: false
            }
        });

        // 🚧 DEV ONLY - return sessionInfo for testing
        if (process.env.NODE_ENV !== "production") {
            return res.json({
                success: true,
                sessionInfo,
                expiresIn: 300
            })
        }

        return res.json({ success: true })
    } catch (error) {
        console.error("Error sending OTP:", error.response?.data || error.message);
        return res.status(500).json({ message: "Failed to send OTP", error: error.response?.data || error.message })
    }
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

// export const verifyOtp = async (req, res) => {
//     try {
//         const { phone, otp } = req.body;

//         if (!phone || !otp) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Phone and OTP required",
//             });
//         }

//         // 1️⃣ Find valid OTP record with sessionInfo
//         const otpRecord = await prisma.oTP.findFirst({
//             where: {
//                 phone,
//                 verified: false,
//                 expiresAt: { gt: new Date() },
//             },
//             orderBy: { createdAt: "desc" },
//         });

//         if (!otpRecord || !otpRecord.sessionInfo) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid or expired OTP session",
//             });
//         }

//         // 2️⃣ Verify OTP using Firebase Auth REST API
//         const signInResponse = await axios.post(
//             `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`,
//             {
//                 sessionInfo: otpRecord.sessionInfo,
//                 code: otp,
//                 phoneNumber: phone
//             }
//         );

//         const idToken = signInResponse.data.idToken;

//         // 3️⃣ Verify the ID token with Firebase Admin SDK
//         const decodedToken = await verifyIdToken(idToken);

//         // 4️⃣ Fetch user
//         const user = await prisma.user.findUnique({
//             where: { phone },
//         });

//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found",
//             });
//         }

//         // 5️⃣ Create session (7 days example)
//         const session = await prisma.session.create({
//             data: {
//                 userId: user.id,
//                 expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//             },
//         });

//         // 6️⃣ Mark OTP verified & invalidate others
//         await prisma.oTP.updateMany({
//             where: { phone, verified: false },
//             data: { verified: true },
//         });

//         // 7️⃣ (Optional) Cookie for web
//         res.cookie("sessionId", session.id, {
//             httpOnly: true,
//             sameSite: "lax",
//             secure: false,
//             // secure: process.env.NODE_ENV === "production",
//             maxAge: 7 * 24 * 60 * 60 * 1000,
//         });

//         // 8️⃣ Return response (Flutter-friendly)
//         return res.json({
//             success: true,
//             sessionId: session.id,
//             user,
//             firebaseUid: decodedToken.uid
//         });
//     } catch (error) {
//         console.error("Verify OTP error:", error.response?.data || error.message);
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

        if (!otpRecord || !otpRecord.sessionInfo) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP session",
            });
        }

        // 2️⃣ Verify OTP with Firebase
        const signInResponse = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`,
            {
                sessionInfo: otpRecord.sessionInfo,
                code: otp,
                phoneNumber: phone,
            }
        );

        const idToken = signInResponse.data.idToken;

        // 3️⃣ Verify Firebase ID token
        const decodedToken = await verifyIdToken(idToken);

        // 4️⃣ Fetch or create user
        let user = await prisma.user.findUnique({
            where: { phone },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    phone,
                },
            });
        }

        // 5️⃣ Create session (7 days)
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // 6️⃣ Mark OTPs verified
        await prisma.oTP.updateMany({
            where: { phone, verified: false },
            data: { verified: true },
        });

        // 7️⃣ Cookie (web)
        res.cookie("sessionId", session.id, {
            httpOnly: true,
            sameSite: "lax",
            secure: false, // enable true in prod behind HTTPS
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // 8️⃣ Response (UNCHANGED)
        return res.json({
            success: true,
            sessionId: session.id,
            user,
            firebaseUid: decodedToken.uid,
        });
    } catch (error) {
        console.error("Verify OTP error:", error.response?.data || error.message);
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
