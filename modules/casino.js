const Game = require('../game');
const Discord = require('discord.js');
const randomEmoji = require('random-emoji');

/**
 * @param {Game} game
 */
module.exports = (game) => {
    game.command('cointoss', async ({ user, args }) => {
        if (!args || !/\d+/g.exec(args)) {
            await game.channel.send(`You need to tell me how much you want to wager.`);
            return;
        }

        const amount = parseInt(args);
        const balance = await game.database.getBalance(user.id);

        if (balance < amount) {
            await game.channel.send(`Haha you don't have that much.`);
            return;
        }

        await game.database.decrementBalance(user.id, amount);

        const headsOrTails = randomEmoji.random({ count: 2 }).map(({ character }) => character);

        const messageText = `Tossing a coin for you, ${user.toString()}. Call it, ${headsOrTails[0]} or ${headsOrTails[1]}?`;

        const { emoji } = await game.modules.BASE.reactionPrompt(
            messageText,
            headsOrTails,
            60000,
            (reaction, sender) => sender.id === user.id
        );

        const answer = Math.random() < 0.5 ? headsOrTails[0] : headsOrTails[1];

        if (emoji === answer) {
            await game.channel.send(`Lucky you, ${user.toString()}. It *was* ${emoji}. You just won ${amount} gold.`);
            await game.database.incrementBalance(user.id, amount * 2);
        } else {
            await game.channel.send(`${user.toString()} Oof. It was actually ${answer}.`);
        }

        await game.modules.BASE.goldResponse(user);
    });
};

module.exports.moduleId = 'CASINO';
