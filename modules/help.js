const Game = require('../game');
const Discord = require('discord.js');

/**
 * @param {Game} game
 */
module.exports = (game) => {
    game.command('help', () => {
        const commands =  Object.keys(game.helpFile).filter((command) => game.helpFile[command]);
        const helpToCommandMap = { };

        commands.forEach((command) => {
            const helpText = game.helpFile[command];

            if (!helpToCommandMap[helpText]) {
                helpToCommandMap[helpText] = [];
            }

            helpToCommandMap[helpText].push(command);
        });

        game.channel.send(
            new Discord.RichEmbed({
                title: 'Available Commands',
                fields: Object.keys(helpToCommandMap).map((help) => ({
                    name: helpToCommandMap[help].join('/'),
                    value: help,
                    inline: true,
                }))
            })
        );
    }, 'Displays this, obviously.');
};

module.exports.moduleId = 'HELP';
