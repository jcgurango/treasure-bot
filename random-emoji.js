const emojis = require('./known-emojis.json');

module.exports = ({ count = 1 } = { }) => {
    // Create a copy of the emoji list.
    const emojiList = emojis.slice(0);

    // Shuffle the emoji list.
    emojiList.sort(() => Math.random() * 2 - 1);

    // Slice off what's needed.
    return emojiList.slice(0, count);
};
