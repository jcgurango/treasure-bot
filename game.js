const Discord = require('discord.js');

module.exports = class Game {
    /**
     * 
     * @param {Discord.TextChannel} channel 
     */
    constructor(channel) {
        this.database = require('./db')(process.argv[3]);
        this.cooldowns = require('./cooldowns');
        this.tickCallbacks = [];
        this.commands = { };
        this.helpFile = { };
        this.channel = channel;
        this.modules = { };
    }

    register(mod) {
        this.modules[mod.moduleId] = mod(this);
    }

    tick(callback) {
        if (callback) {
            this.tickCallbacks.push(callback);
        } else {
            this.tickCallbacks.forEach((callback) => callback());
        }
    }

    command(prompt, callback, help) {
        if (!this.commands[prompt]) {
            this.commands[prompt] = [];
        }

        this.commands[prompt].push(callback);

        if (help) {
            this.helpFile[prompt] = help;
        }
    }

    start() {
        this.tickInterval = setInterval(() => {
            this.tick();
        }, 60000);
    }

    processCommand(user, command, args, mentions) {
        this.commands[command] && this.commands[command].forEach((callback) => callback({ command, user, args, mentions }));
    }
};
