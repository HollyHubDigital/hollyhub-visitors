const assert = require('assert');
const { getProjectDescriptionPreview, buildProjectDescriptionMarkup } = require('../contact-description-utils');

const longDescription = 'This is a very long project description that should be collapsed on smaller viewports until the user chooses to expand it for the full context. It should continue to show enough detail for the medium and large layouts while still staying compact on small screens for readability and layout stability.';

const smallViewport = getProjectDescriptionPreview(longDescription, 375);
assert.strictEqual(smallViewport.isTruncated, true, 'Small viewports should truncate long descriptions');
assert.ok(smallViewport.previewText.length <= 120, 'Preview text should fit the small viewport threshold');
assert.ok(smallViewport.previewText.endsWith('…'), 'Preview text should end with an ellipsis when truncated');

const mediumViewport = getProjectDescriptionPreview(longDescription, 600);
assert.strictEqual(mediumViewport.isTruncated, true, 'Medium viewports should also truncate long descriptions');
assert.ok(mediumViewport.previewText.length <= 220, 'Preview text should fit the medium viewport threshold');

const markup = buildProjectDescriptionMarkup(longDescription, 'project-1', 375);
assert.ok(markup.includes('Show more'), 'Markup should include a toggle for long descriptions');
assert.ok(markup.includes('data-preview-text'), 'Markup should include preview text data');
assert.ok(markup.includes('data-full-text'), 'Markup should include full text data');

console.log('contact description utility tests passed');
