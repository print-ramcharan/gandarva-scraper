/**
 * YouTube video ID validator.
 *
 * A valid YouTube video ID is exactly 11 characters and contains only
 * alphanumeric characters, hyphens, and underscores.
 */

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function isValidVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_REGEX.test(id);
}

module.exports = { isValidVideoId };
