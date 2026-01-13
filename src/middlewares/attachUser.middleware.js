export const attachUser = (req, res, next) => {
    const userId = req.headers["x-user-id"]
    const phone = req.headers["x-user-phone"]

    // console.log("userId at attachuser", userId)
    // console.log("phone at attachuser", phone)

    if (userId && phone) {
        req.user = {
            id: String(userId),
            phone: String(phone)
        }
    }

    next()
}