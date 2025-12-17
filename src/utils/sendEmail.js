const nodemailer = require('nodemailer');

/**
 * Create nodemailer transporter with Gmail SMTP
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send email using Gmail SMTP
 */
const sendEmailViaSMTP = async (to, subject, htmlContent) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: 'Elderly Home Care',
        address: process.env.EMAIL_USER
      },
      to: to,
      subject: subject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent via Gmail SMTP:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Gmail SMTP error:', error.message);
    
    // Trong development mode, cho phép tiếp tục dù email fail
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ [DEV MODE] Email sending failed but continuing...');
      return true;
    }
    
    throw new Error(`Gmail SMTP failed: ${error.message}`);
  }
};

/**
 * Gửi email verification code
 */
const sendVerificationCode = async (email, name, code) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Elderly Home Care, ${name}!</h2>
        <p>Thank you for registering. Please use the verification code below to verify your email address.</p>
        
        <div style="background-color: #f5f5f5; padding: 30px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your verification code is:</p>
          <h1 style="margin: 0; font-size: 36px; color: #4CAF50; letter-spacing: 8px;">${code}</h1>
        </div>
        
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        
        <p style="margin-top: 30px; font-size: 12px; color: #999;">
          If you didn't create an account, please ignore this email.
        </p>
      </div>
    `;

    await sendEmailViaSMTP(email, 'Your Verification Code', htmlContent);
    
    // In ra console trong dev mode để dễ debug
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEV MODE] Verification Code:', code);
      console.log('📧 Email:', email);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error sending verification code:', error.message);
    throw new Error('Failed to send verification code');
  }
};

/**
 * Gửi email welcome sau khi verify
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome, ${name}!</h2>
        <p>Your email has been successfully verified.</p>
        <p>You can now enjoy all features of Elderly Home Care.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Get Started:</h3>
          <ul style="line-height: 1.8;">
            <li>Complete your profile</li>
            <li>Browse available caregivers</li>
            <li>Book your first appointment</li>
          </ul>
        </div>
        
        <p style="margin-top: 30px; font-size: 12px; color: #999;">
          If you have any questions, feel free to contact our support team.
        </p>
      </div>
    `;
    
    await sendEmailViaSMTP(email, 'Welcome to Elderly Home Care!', htmlContent);
    console.log('✅ Welcome email sent');
    
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Không throw error vì đây là email phụ
  }
};

/**
 * Gửi email reset password code
 */
const sendResetPasswordCode = async (email, name, code) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Use the code below to reset your password:</p>
        
        <div style="background-color: #f5f5f5; padding: 30px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your reset password code is:</p>
          <h1 style="margin: 0; font-size: 36px; color: #FF5722; letter-spacing: 8px;">${code}</h1>
        </div>
        
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
        
        <p style="margin-top: 30px; font-size: 12px; color: #999;">
          For security reasons, never share this code with anyone.
        </p>
      </div>
    `;
    
    await sendEmailViaSMTP(email, 'Reset Your Password', htmlContent);
    console.log('✅ Reset password code sent to:', email);
    return true;
    
  } catch (error) {
    console.error('❌ Error sending reset password code:', error.message);
    throw new Error('Failed to send reset password code');
  }
};

module.exports = {
  sendVerificationCode,
  sendWelcomeEmail,
  sendResetPasswordCode
};
