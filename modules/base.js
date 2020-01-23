const Game = require('../game');
const Discord = require('discord.js');

/**
 * @param {Game} game
 */
module.exports = (game) => {
    // Register commands.
    const statsCommand = async ({ user, mentions }) => {
        const mentionedUser = mentions.users.first();
        const userLookup = mentionedUser || user;
        const lookupUser = await game.database.getUser(userLookup.id);

        await game.channel.send(
            (
                new Discord.RichEmbed({
                    title: `${userLookup.username}`,
                })
            )
            .addField('Gold', lookupUser.balance.toLocaleString(), true)
            .addField('Kills', lookupUser.kills.toLocaleString(), true)
            .addField('Deaths', lookupUser.deaths.toLocaleString(), true)
        );
    };

    game.command('balance', statsCommand);

    const goldResponse = async (user) => {
        return game.channel.send(`${user.toString()} now has **${(await game.database.getBalance(user.id)).toLocaleString()} gold**.`);
    };

    const reactionPrompt = async (message, emojis, time, filter) => {
        const { channel } = game;
        const newMessage = await channel.send(message);
        Promise.all(emojis.map(async (emoji) => newMessage.react(emoji)));

        let user = null;
        let emoji = null;
    
        await newMessage.awaitReactions(
                (reaction, user) => user.id !== newMessage.author.id && (!filter || filter(reaction, user)),
                { max: 1, time, errors: ['time'] }
            )
            .then(async (collected) => {
                const reaction = collected.first();
                const { users } = reaction;
                const winner = users.last();
    
                if (winner) {
                    user = winner;
                    emoji = reaction.emoji.name;
                }
            })
            .catch(() => { });

        return {
            user,
            message: newMessage,
            emoji,
        };
    };

    return {
        goldResponse,
        reactionPrompt,
    };
};

module.exports.moduleId = 'BASE';
