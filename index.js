/**
 * A ping pong bot, whenever you send "ping", it replies "pong".
 */

// Treasure bot database
const db = require('./db')(process.argv[3]);

// Import the discord.js module
const Discord = require('discord.js');
const giphy = require('giphy-api')();
const randomEmoji = require('random-emoji');
const Sentencer = require('sentencer');

// Create an instance of a Discord client
const client = new Discord.Client();

const isChannelApplicable = (id) => {
    return id == process.argv[2];
};

/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */
client.on('ready', () => {
  console.log('I am ready!');
});

// Create an event listener for messages
client.on('message', async message => {
    if (isChannelApplicable(message.channel.id)) {
        const parsed = /^treasure(?: (\w+))?(?: (.+))?$/.exec(message.content);

        if (parsed) {
            const [match, command = 'balance', args = ''] = parsed;

            if (command === 'balance' || command === 'inventory' || command === 'stats') {
                const mentionedUser = message.mentions.users.first();
                const userLookup = mentionedUser || message.author;
                const user = await db.getUser(userLookup.id);
                const items = await db.getItems(userLookup.id);

                await message.channel.send(
                    (
                        new Discord.RichEmbed({
                            title: `${userLookup.username}`,
                        })
                    )
                    .addField('Gold', user.balance.toLocaleString(), true)
                    .addField('Kills', user.kills.toLocaleString(), true)
                    .addField('Deaths', user.deaths.toLocaleString(), true)
                    .addField('Inventory', items.map(({ item: { name, icon } }) => `${icon} ${name}`).join('\n') || '- Empty -')
                );
            }

            if (command === 'trigger' && message.author.id === '220193117016424458') {
                trigger();
            }

            if (command === 'debug' && message.author.id === '220193117016424458') {
                await db.userItems.insert({
                    user: '220193117016424458',
                    item: 'sword-basic',
                });
            }
        }
    }
});

const trigger = async () => {
    const { data: { image_url: gif } = { image_url: 'https://media.giphy.com/media/l0ExhcMymdL6TrZ84/giphy.gif' } } = await giphy.random('gold');

    client.channels.filter(({ id }) => isChannelApplicable(id)).forEach(async (channel) => {
        const emoji = randomEmoji.random()[0].character;
        const amount = Math.floor((Math.random() * 1000) + 1500);

        let attachment = new Discord.RichEmbed({
            title: Sentencer.make(`Holy {{ adjective }} {{ adjective }} {{ noun }} with {{ a_noun }}! A treasure chest with ${amount.toLocaleString()} gold! React with a ${emoji} first to claim it!`),
        });

        attachment = attachment.setImage(gif);
        const message = await channel.send(attachment);

        await message.awaitReactions((reaction) => reaction.emoji.name === emoji, { max: 1, time: 60 * 60 * 1000, errors: ['time'] })
            .then(async (collected) => {
                const { users } = collected.first();
                const winner = users.first();

                if (winner) {
                    await db.incrementBalance(winner.id, amount);
                    channel.send(`Congrats ${winner.toString()}! You now have ${(await db.getBalance(winner.id)).toLocaleString()} gold.`);
                    message.edit(Sentencer.make(`The {{ adjective }} {{ adjective }} ${winner.toString()} got this!`));
                }
            })
            .catch(() => {
                message.edit(new Discord.RichEmbed({ title: Sentencer.make(`Well, {{ adjective }} {{ nouns }} with {{ adjective }} {{ nouns }}. Nobody got it.`) }));
            });
    });
};

setInterval(() => {
    console.log('Interval!');

    if (Math.random() < 0.5) {
        trigger();
    }
}, 6 * 60 * 1000);

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(process.argv[3]);
