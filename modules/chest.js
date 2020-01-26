const Game = require('../game');
const Discord = require('discord.js');
const giphy = require('giphy-api')();
const randomEmoji = require('../random-emoji');
const Sentencer = require('sentencer');
const variables = require('../variables');

/**
 * @param {Game} game
 */
module.exports = (game) => {
    const chest = async () => {
        const { data: { image_url: gif } = { image_url: 'https://media.giphy.com/media/l0ExhcMymdL6TrZ84/giphy.gif' } } = await giphy.random('gold');
    
        const emoji = randomEmoji()[0];
        const amount = Math.floor((Math.random() * 1000) + 1500);
    
        let attachment = new Discord.RichEmbed({
            title: Sentencer.make(`Holy {{ adjective }} {{ adjective }} {{ noun }} with {{ a_noun }}! A treasure chest with ${amount.toLocaleString()} gold! Press the ${emoji} first to claim it!`),
        });
    
        attachment = attachment.setImage(gif);
        const emojis = [emoji, ...randomEmoji({ count: 5 })];
        emojis.sort(() => Math.random() * 2 - 1);

        const { user, message } = await game.modules.BASE.reactionPrompt(attachment, emojis, 60 * 60 * 1000, (reaction) => reaction.emoji.name === emoji);

        if (user) {
            await game.database.incrementBalance(user.id, amount);
            await game.modules.BASE.goldResponse(user);
            await message.edit(Sentencer.make(`The {{ adjective }} {{ adjective }} ${user.toString()} got this!`));
        } else {
            await message.edit(new Discord.RichEmbed({ title: Sentencer.make(`Well, {{ adjective }} {{ nouns }} with {{ adjective }} {{ nouns }}. Nobody got it.`) }));
        }
    };

    game.tick(() => {
        if (Math.random() < 0.1) {
            chest();
        }
    });

    game.command('chest', ({ user }) => {
        if (variables.isTestEnvironment) {
            chest();
        }
    });

    return {
        chest,
    };
};

module.exports.moduleId = 'CHEST';
