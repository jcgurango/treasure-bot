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

    game.command('balance', statsCommand, 'Displays your gold, kills, and deaths.');
    game.command('kills', statsCommand, 'Displays your gold, kills, and deaths.');
    game.command('deaths', statsCommand, 'Displays your gold, kills, and deaths.');

    game.command('pay', async ({ user, mentions, args = '' }) => {
        const [mention, specifiedAmount] = args.split(' ');
        const mentionedUser = mentions.users.first();

        if (!mentionedUser) {
            game.channel.send(`${user.toString()} you must specify somebody to give it to.`);
            return;
        }

        const amount = Math.max(1, parseInt(specifiedAmount));

        if (!amount) {
            game.channel.send(`${user.toString()} you must specify an amount.`);
            return;
        }
        
        const userInfo = await game.database.getUser(user.id);
        
        if (userInfo.balance < amount) {
            game.channel.send(`${user.toString()} you don't have that much to give.`);
            return;
        }

        await game.database.decrementBalance(user.id, amount);
        await game.database.incrementBalance(mentionedUser.id, amount);
        game.channel.send(`${user.toString()} just gave ${mentionedUser.toString()} ${amount.toLocaleString()} gold!`);
    }, 'Gives another user your gold.');

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

    const acceptPrompt = async (user, message) => {
        const { emoji } = await game.modules.BASE.reactionPrompt(
            message,
            ['✅'],
            60 * 1000,
            (reaction, reactor) => reactor.id === user.id
        );

        return emoji === '✅';
    };

    return {
        goldResponse,
        reactionPrompt,
        acceptPrompt,
    };
};

module.exports.moduleId = 'BASE';
