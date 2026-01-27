const verifyTokenTest = async (req, res, next) => {
    req.user = {
        uid: "test-uid-123",
        email: "test@fare.com"
    };
    console.log('Test mode: Using mock authentication');
    next();
}
module.exports = { verifyTokenTest };