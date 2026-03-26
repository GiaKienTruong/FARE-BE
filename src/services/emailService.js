const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587, // Port 587 không bị block trên Render (free tier)
    secure: false, // Dùng STARTTLS
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

/**
 * Send OTP Email
 * @param {string} email - Recipient email
 * @param {string} otp - 5 or 6 digit code
 */
const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: `"FARE App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your FARE Verification Code',
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #71D5F3;">Welcome to FARE!</h2>
                <p>Use the following code to verify your email address:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111; padding: 20px; background: #f4f4f4; border-radius: 8px; text-align: center; margin: 20px 0;">
                    ${otp}
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999;">&copy; 2026 FARE Fashion AI</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] OTP sent to ${email}`);
        return true;
    } catch (error) {
        console.error('[EMAIL] Error sending email:', error);
        throw error;
    }
};

module.exports = {
    sendOTPEmail,
};
