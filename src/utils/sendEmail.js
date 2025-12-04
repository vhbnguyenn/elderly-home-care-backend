const nodemailer = require('nodemailer');

/**
 * Tạo transporter để gửi email
 */
const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT) || 465;
  
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user: process.env.BREVO_LOGIN || process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    pool: true,
    maxConnections: 5,
    rateDelta: 1000,
    rateLimit: 5
  });
};

/**
 * Gửi email verification code
 */
const sendVerificationCode = async (email, name, code) => {
  try {
    // Kiểm tra có config email chưa
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || 
        process.env.EMAIL_USER === 'your_email@gmail.com') {
      // Chưa config email → In code ra console để test
      console.log('⚠️  Email not configured. Verification code:');
      console.log('📧 Email:', email);
      console.log('🔑 Code:', code);
      console.log('⏰ Expires in: 10 minutes');
      return true;
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Elderly Home Care" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      html: `
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
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification code sent:', info.messageId);
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
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Elderly Home Care" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Elderly Home Care!',
      html: `
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
      `
    };
    
    await transporter.sendMail(mailOptions);
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
    // Kiểm tra có config email chưa
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || 
        process.env.EMAIL_USER === 'your_email@gmail.com') {
      // Chưa config email → In code ra console để test
      console.log('⚠️  Email not configured. Reset password code:');
      console.log('📧 Email:', email);
      console.log('🔑 Code:', code);
      console.log('⏰ Expires in: 10 minutes');
      return true;
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Elderly Home Care" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password',
      html: `
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
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Reset password code sent:', info.messageId);
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
