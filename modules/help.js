const Game = require('../game');
const Discord = require('discord.js');

/**
 * @param {Game} game
 */
module.exports = (game) => {
    game.command('help', () => {
        game.channel.send(
            new Discord.RichEmbed({
                title: 'Available Commands',
                fields: Object.keys(game.helpFile).map((command) => ({
                    name: command,
                    value: game.helpFile[command],
                    inline: true,
                }))
            })
        );
    }, 'Displays this, obviously.');
};

module.exports.moduleId = 'HELP';
