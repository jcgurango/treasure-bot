/**
 * A ping pong bot, whenever you send "ping", it replies "pong".
 */

// Import the discord.js module
const Discord = require('discord.js');

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
    const games = { };

    client.channels.filter(({ id }) => isChannelApplicable(id)).forEach(async (channel) => {
        const game = new (require('./game'))(channel);
        game.register(require('./modules/base'));
        game.register(require('./modules/chest'));
        game.register(require('./modules/fight'));
        game.register(require('./modules/casino'));
        games[channel.id] = game;
        game.start();
    });

    // Create an event listener for messages
    client.on('message', async message => {
        if (isChannelApplicable(message.channel.id)) {
            const parsed = /^treasure(?: (\w+))?(?: (.+))?$/.exec(message.content);

            if (parsed) {
                const [match, command = 'balance', args = ''] = parsed;
                games[message.channel.id].processCommand(message.author, command, args, message.mentions);
            }
        }
    });
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(process.argv[3]);
