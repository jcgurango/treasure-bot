const Game = require('../game');
const Discord = require('discord.js');
const Sentencer = require('sentencer');
const variables = require('../variables');
const Item = require('../item');

const levelXp = (level) => ({
    "1": 0,
    "2": 300,
    "3": 900,
    "4": 2700,
    "5": 6500,
    "6": 14000,
    "7": 23000,
    "8": 34000,
    "9": 48000,
    "10": 64000,
    "11": 85000,
    "12": 100000,
    "13": 120000,
    "14": 140000,
    "15": 165000,
    "16": 195000,
    "17": 225000,
    "18": 265000,
    "19": 305000,
    "20": 355000,
}[level] || ((level - 20) * 60000 + 355000));

/**
 * @param {Game} game
 */
module.exports = (game) => {
    game.command('stats', async ({ user, mentions }) => {
        const mentionedUser = mentions.users.first();
        const userLookup = mentionedUser || user;
        const lookupStats = await game.database.getUserStats(userLookup.id);
        const items = await game.database.getItems(userLookup.id);

        const msg = new Discord.RichEmbed({
                title: Sentencer.make(`${userLookup.username}, ${lookupStats.title}`),
            })
            .addField('ATK/DEF',
                `${lookupStats.ATK.toLocaleString()}/${lookupStats.DEF.toLocaleString()}`
            , true)
            .addField('XP',
                `${lookupStats.XP.toLocaleString()}/${levelXp(lookupStats.level + 1)}`
            , true)
            .addField('---------------', 'Equipped')
            .addField('---------------', 'Inventory');

        msg.fields = [...msg.fields, ...items.sort((a, b) => b.value - a.value).map((item) => item.asField()).slice(0, 21)];

        if (items.length > 21) {
            msg.fields[msg.fields.length - 1] = {
                name: `+ ${items.length - 20} more`,
                value: 'To see the rest of this junk, you\'ll need to sell some items.',
                inline: true,
            };
        }

        await game.channel.send(
            msg,
        );
    });

    game.command('loot', async ({ user }) => {
        if (variables.isTestEnvironment) {
            giveLoot(user, [
                Item.generate(Math.floor(Math.random() * 100) + 1),
                Item.generate(Math.floor(Math.random() * 100) + 1),
                Item.generate(Math.floor(Math.random() * 100) + 1),
                Item.generate(Math.floor(Math.random() * 100) + 1),
                Item.generate(Math.floor(Math.random() * 100) + 1),
                Item.generate(Math.floor(Math.random() * 100) + 1),
                Item.generate(Math.floor(Math.random() * 100) + 1),
                Item.generate(Math.floor(Math.random() * 100) + 1)
            ]);
        }
    });

    const gainXp = async (user, amount) => {
        const stats = await game.database.getUserStats(user.id);
        await game.database.setUserStatsXP(user.id, stats.XP + amount);
        stats.XP += amount;

        while (stats.XP > levelXp(stats.level + 1)) {
            // Level up!
            stats.level++;
            await game.database.setUserStatsLevel(user.id, stats.level);

            let statPoints = 1 + (Math.ceil(stats.level / 4));
            let plusATK = 0;
            let plusDEF = 0;

            while (statPoints > 0) {
                if (Math.random() > 0.5) {
                    plusATK++;
                } else {
                    plusDEF++;
                }

                statPoints--;
            }

            await game.database.updateUserStats(user.id, {
                ATK: stats.ATK + plusATK,
                DEF: stats.DEF + plusDEF,
            });

            stats.ATK += plusATK;
            stats.DEF += plusDEF;

            await game.channel.send(`${user.toString()} is now level ${stats.level}! (You gain +${plusATK} ATK and +${plusDEF} DEF)`);
        }
    };

    const monsterStats = async (level) => {
        const stats = {
            level,
            ATK: 5,
            DEF: 5,
        };

        for (let i = 1; i < level; i++) {
            let statPoints = 1 + (Math.ceil(stats.level / 4));
            let plusATK = 0;
            let plusDEF = 0;

            while (statPoints > 0) {
                if (Math.random() > 0.5) {
                    plusATK++;
                } else {
                    plusDEF++;
                }

                statPoints--;
            }

            level--;
            stats.ATK += plusATK;
            stats.DEF += plusDEF;
        }

        return stats;
    };

    const userStats = async (user) => {
        const stats = await game.database.getUserStats(user.id);

        return {
            level: stats.level,
            ATK: stats.ATK,
            DEF: stats.DEF,
            ATKBonus: 0,
            DEFBonus: 0,
        };
    };

    const giveLoot = async (user, loot = []) => {
        await Promise.all(loot.map(async (item) => (await game.database.giveItem(user.id, item))));

        await game.channel.send(
            new Discord.RichEmbed({
                title: Sentencer.make(`Loot Drops for ${user.username}!`),
                fields: loot.map((item) => item.asField()),
            })
        );
    };

    return {
        gainXp,
        userStats,
        monsterStats,
    };
};

module.exports.moduleId = 'RPG';
