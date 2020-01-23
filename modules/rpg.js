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

const ITEM_PAGE_SIZE = 11;

/**
 * @param {Game} game
 */
module.exports = (game) => {
    const getEquippedItems = async (playerId) => {
        const stats = await game.database.getUserStats(playerId);
        const items = await game.database.getItems(playerId);

        // Get the highest possible armor and weapon for their level.
        const weapon = items.sort((a, b) => b.value - a.value).find((item) => item.type === 'weapon' && item.level <= stats.level);
        const armor = items.sort((a, b) => b.value - a.value).find((item) => item.type === 'armor' && item.level <= stats.level);

        return [
            weapon,
            armor,
        ];
    };

    const sheetCommand = async ({ user, mentions, args }) => {
        const mentionedUser = mentions.users.first();
        const userLookup = mentionedUser || user;
        const lookupStats = await game.database.getUserStats(userLookup.id);
        const page = parseInt(args) || 1;
        const equipped = await getEquippedItems(userLookup.id);
        let items = (await game.database.getItems(userLookup.id)).sort((a, b) => b.value - a.value).map((item) => item.asField());
        const maxPages = Math.ceil(items.length / ITEM_PAGE_SIZE);
        items = items.slice((page - 1) * ITEM_PAGE_SIZE);
        const ATKBonus = equipped.reduce((val, item) => (val + (item && item.stats.ATK || 0)), 0);
        const DEFBonus = equipped.reduce((val, item) => (val + (item && item.stats.DEF || 0)), 0);

        const msg = new Discord.RichEmbed({
                title: Sentencer.make(`${userLookup.username}, ${lookupStats.title}, Level ${lookupStats.level}`),
            })
            .addField('ATK/DEF',
                `${lookupStats.ATK.toLocaleString()} (+${ATKBonus}) / ${lookupStats.DEF.toLocaleString()} (+${DEFBonus})`
            , true)
            .addField('XP',
                `${lookupStats.XP.toLocaleString()}/${levelXp(lookupStats.level + 1).toLocaleString()}`
            , true);

        msg.fields = [
            ...msg.fields,
            {
                name: '---------------',
                value: 'Equipped',
            },
            equipped[0] && equipped[0].asField() || {
                name: 'Fists',
                value: 'You either have no weapon in your inventory, or are too low-level to equip any of them.',
                inline: true,
            },
            equipped[1] && equipped[1].asField() || {
                name: 'Clothes',
                value: 'You either have no armor in your inventory, or are too low-level to equip any of them.',
                inline: true,
            },
            {
                name: '---------------',
                value: 'Inventory',
            },
            ...items.slice(0, ITEM_PAGE_SIZE + 1)
        ];

        if (items.length > ITEM_PAGE_SIZE) {
            msg.fields[msg.fields.length - 1] = {
                name: `+ ${items.length - ITEM_PAGE_SIZE} more`,
                value: `This is page ${page} of ${maxPages}. Use the \`junk\` or \`sell\` commands to get rid of some of this crap or specify a page number to browse.`,
                inline: true,
            };
        }

        await game.channel.send(
            msg,
        );
    };

    game.command('sheet', sheetCommand, 'Displays your character sheet.');
    game.command('stats', sheetCommand, 'Displays your character sheet.');
    game.command('items', sheetCommand, 'Displays your character sheet.');
    game.command('level', sheetCommand, 'Displays your character sheet.');
    game.command('inventory', sheetCommand, 'Displays your character sheet.');

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

        // Find their equipped stuff.
        const equipped = await getEquippedItems(user.id);

        return {
            level: stats.level,
            ATK: stats.ATK,
            DEF: stats.DEF,
            ATKBonus: equipped.reduce((val, item) => (val + (item && item.stats.ATK || 0)), 0),
            DEFBonus: equipped.reduce((val, item) => (val + (item && item.stats.DEF || 0)), 0),
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
        giveLoot,
        gainXp,
        userStats,
        monsterStats,
    };
};

module.exports.moduleId = 'RPG';
