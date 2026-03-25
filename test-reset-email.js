/**
 * Test script to verify password reset flow
 * Usage: node test-reset-email.js
 */

require('dotenv').config();

const testResetEmail = async () => {
  console.log('🔍 Password Reset Email Test\n');
  console.log('='.repeat(50));
  
  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log('✓ RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✓ SET (' + process.env.RESEND_API_KEY.substring(0, 10) + '...)' : '✗ NOT SET');
  console.log('✓ GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? '✓ SET (' + process.env.GITHUB_TOKEN.substring(0, 10) + '...)' : '✗ NOT SET');
  console.log('✓ NODE_ENV:', process.env.NODE_ENV || 'development');
  
  if (!process.env.RESEND_API_KEY) {
    console.log('\n❌ RESEND_API_KEY is missing!');
    console.log('   Add it to .env file: RESEND_API_KEY=re_xxxxx');
    return false;
  }

  // Test Resend API connection
  console.log('\n🚀 Testing Resend API Connection...');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ['hollyhub146@gmail.com'],
        subject: 'Test: HollyHub Password Reset',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>🔐 Password Reset Test</h2>
            <p>This is a test email from the password reset system.</p>
            <p><strong>Reset Link:</strong> https://hollyhubdigitals.vercel.app/reset.html?token=TEST_TOKEN_12345</p>
            <hr />
            <p style="font-size: 12px; color: #888;">If you didn't request this, ignore this email.</p>
          </div>
        `
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ SUCCESS! Resend API accepted the email');
      console.log('   Email ID:', data.id);
      console.log('   Status: Email queued for delivery');
      console.log('\n📧 Email Details:');
      console.log('   To: hollyhub146@gmail.com');
      console.log('   From: onboarding@resend.dev');
      console.log('   Subject: Test: HollyHub Password Reset');
      console.log('\n💡 Check the inbox in ~1 minute');
      return true;
    } else {
      console.log('❌ FAILED! Resend API returned error:');
      console.log('   Status:', response.status);
      console.log('   Error:', data.error || data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR: Failed to connect to Resend API');
    console.log('   ', error.message);
    return false;
  }
};

testResetEmail().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ Test completed successfully!\n');
  } else {
    console.log('❌ Test failed. Check the errors above.\n');
  }
  process.exit(success ? 0 : 1);
});
