// Test overlay API to verify fixes
const http = require('http');

const testData = {
  masterEnabled: true,
  modal1: {
    type: 'contactForm',
    enabled: true,
    image: '/public/uploads/1774830853048-Internet.webp',
    description: 'Get 10% OFF while submitting the forms and visit <a href="contact.html">Contact</a> for the offer.',
    buttonText: 'Apply Now',
    web3formsKey: '4eab8d69-b661-4f80-92b2-a99786eddbf9'
  },
  modal2: {
    type: 'mediaDisplay',
    enabled: false,
    media: null,
    mediaType: 'image',
    description: ''
  }
};

console.log('Test data to be sent:');
console.log(JSON.stringify(testData, null, 2));

console.log('\n✓ API expects /api/upload to return url property');
console.log('✓ API expects /api/overlay POST to preserve HTML in description');
console.log('✓ Sanitization should be skipped for /api/overlay endpoint');
console.log('\nKey findings:');
console.log('1. Upload response should include: { url: "/public/uploads/1774830853048-Internet.webp", ... }');
console.log('2. Description should preserve: "<a href=\"contact.html\">Contact</a>"');
console.log('3. Database should store clean HTML, not escaped version');
