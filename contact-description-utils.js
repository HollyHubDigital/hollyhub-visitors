function getProjectDescriptionPreview(text, viewportWidth) {
  const safeText = typeof text === 'string' ? text : '';
  const trimmed = safeText.trim();
  const threshold = viewportWidth <= 480 ? 120 : viewportWidth <= 600 ? 220 : 320;
  const isLong = trimmed.length > threshold;

  if (!isLong) {
    return { isTruncated: false, previewText: trimmed, fullText: trimmed };
  }

  const previewLength = Math.max(1, threshold - 1);
  const previewText = `${trimmed.slice(0, previewLength).trimEnd()}…`;
  return { isTruncated: true, previewText, fullText: trimmed };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildProjectDescriptionMarkup(description, projectId, viewportWidth) {
  const preview = getProjectDescriptionPreview(description, viewportWidth);
  const escapedFullText = escapeHtml(preview.fullText);
  const escapedPreviewText = escapeHtml(preview.previewText);

  if (!preview.isTruncated) {
    return `<div class="project-description-text" data-project-id="${projectId}">${escapedFullText}</div>`;
  }

  return `
    <div class="project-description-text" data-project-id="${projectId}">
      <div class="project-description-body" data-preview-text="${escapedPreviewText}" data-full-text="${escapedFullText}" data-expanded="false">
        ${escapedPreviewText}
      </div>
      <button type="button" class="project-description-toggle" data-project-id="${projectId}" data-expanded="false" aria-expanded="false">Show more</button>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.getProjectDescriptionPreview = getProjectDescriptionPreview;
  window.buildProjectDescriptionMarkup = buildProjectDescriptionMarkup;
  window.escapeHtml = escapeHtml;
}

if (typeof module !== 'undefined') {
  module.exports = { getProjectDescriptionPreview, buildProjectDescriptionMarkup, escapeHtml };
}
