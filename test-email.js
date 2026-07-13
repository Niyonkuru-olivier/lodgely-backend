const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Configured values:');
console.log('Host:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('User:', process.env.SMTP_USER);
console.log('Pass:', process.env.SMTP_PASS ? '********' : 'undefined');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log('Verifying connection...');
transporter.verify(function (error, success) {
  if (error) {
    console.error('Transporter verification failed:', error);
    process.exit(1);
  } else {
    console.log('Server is ready to take our messages');
    
    console.log('Sending test email...');
    transporter.sendMail({
      from: `"Lodgely Support" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // send to self
      subject: 'Test Email from Lodgely Verification Script',
      text: 'If you receive this, the email configuration is working!',
    }).then(info => {
      console.log('Email sent successfully:', info.messageId);
      process.exit(0);
    }).catch(err => {
      console.error('Failed to send email:', err);
      process.exit(1);
    });
  }
});
