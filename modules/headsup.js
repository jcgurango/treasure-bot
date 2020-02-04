const Game = require('../game');
const Discord = require('discord.js');

/**
 * @param {Game} game
 */
module.exports = (game) => {
    let lastMessage = null;

    const headsUp = async () => {
        if (lastMessage) {
            await lastMessage.delete();
        }

        lastMessage = game.channel.send('Heads up: Treasure Bot is totally open source! Have a peek through the code here: https://github.com/jcgurango/treasure-bot\n\nLet Lucifer#2596 know if you find any bugs or make a PR if you\'ve implemented something cool!');
    };

    game.tick(async (time) => {
        if (time % 60 === 0) {
            await headsUp();
        }
    });

    headsUp();
};

module.exports.moduleId = 'HEADSUP';