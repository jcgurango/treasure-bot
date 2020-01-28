const Game = require('../game');
const Discord = require('discord.js');
const Sentencer = require('sentencer');
const variables = require('../variables');
const fantasyNames = require('fantasy-names');
const Item = require('../item');
const escapeStringRegexp = require('escape-string-regexp');
const colors = require('../discord-colors');

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

const ITEM_PAGE_SIZE = 5;
const MAX_SELL_DISPLAY = 30;

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

    let shopkeepName, sellValue, shopItems;

    game.command('shop', () => {
        game.channel.send(
            new Discord.RichEmbed({
                title: `${shopkeepName}'s Wares (Changes every 5 minutes)`,
                fields: shopItems.map((item) => item.asField()),
            })
        );
    }, 'Displays the shop.');

    const searchItems = (items, search) => {
        const [item] = items
            .filter(({ name }) => new RegExp(escapeStringRegexp(search), 'i').exec(name))
            .sort((a, b) => a.value - b.value);

        return item;
    };

    game.command('buy', async ({ user, args }) => {
        if (!args) return;

        // Find the item.
        const shopkeep = shopkeepName;
        const item = searchItems(shopItems, args);

        if (!item) {
            return game.channel.send(`No item found with name ${args}.`);
        }

        const { balance } = await game.database.getUser(user.id);

        if (item.value > balance) {
            return game.channel.send(`**${shopkeep}**: Pfft, you can't afford that.`);
        }

        const accept = await game.modules.BASE.acceptPrompt(user, new Discord.RichEmbed({
            title: `Buy for ${item.value.toLocaleString()} gold?`,
            fields: [item.asField()],
        }));

        if (accept) {
            shopItems.splice(shopItems.indexOf(item), 1);
            await game.database.giveItem(user.id, item);
            await game.database.decrementBalance(item.value);
            await game.channel.send(`**${shopkeep}**: Pleasure doing business with you!\n**${shopkeep} (under its breath)**: sucker.`);
        }
    }, 'Buys an item from the shop.');

    const regenShop = async () => {
        shopkeepName = fantasyNames('fantasy')[0];
        sellValue = Math.random() * 0.65 + 0.25;
        shopItems = [];

        const inPlayUserIds = await game.database.getUserIds();
        const inPlayMembers = game.channel.members.filter((member) => !member.user.bot && inPlayUserIds.includes(member.user.id)).array();

        for (let i = 0; i < 14; i++) {
            const focusMember = inPlayMembers[Math.floor(Math.random() * inPlayMembers.length)];
            const { level: focusLevel } = await game.modules.RPG.userStats(focusMember.user);
            const level = Math.max(1, Math.floor(focusLevel + Math.random() * 10 - 5));
            shopItems.push(Item.generate(level));
        }

        shopItems.push(new Item({
            name: 'IRL Drink of Choice',
            type: 'item',
            rarity: 'special',
            durability: 100000,
            maxDurability: 100000,
            level: 100,
            value: 10000000,
            description: 'A free real-life drink claimable from `<@220193117016424458>`. (Max 200 pesos)',
            stats: { },
        }));
    };

    game.tick((time) => {
        if (time % 5 === 0) {
            regenShop();
        }
    });

    regenShop();

    game.command('loot', async ({ user, args }) => {
        const maxLevel = parseInt(args) || 100;

        if (variables.isTestEnvironment) {
            const items = [];

            for (var i = 0; i < 10; i++) {
                items.push(
                    Item.generate(Math.floor(Math.random() * maxLevel) + 1)
                );
            }

            giveLoot(user, items);
        }
    });

    const sellItems = async (shopkeep, buyPrice, user, items) => {
        await game.database.removeItems(user.id, items.map(({ _id }) => _id));
        await game.database.incrementBalance(user.id, buyPrice);
        await game.channel.send(`**${shopkeep}**: Pleasure doing business with you!\n**${shopkeep} (under its breath)**: sucker.`);
        await game.modules.BASE.goldResponse(user);
    };

    const getUserItem = async (userId, search) => {
        return await searchItems(await game.database.getItems(userId), search);
    };

    game.command('give', async ({ user, args, mentions }) => {
        const [mention, search] = args.split(' ', 2);
        const mentionedUser = mentions.users.first();

        if (!mentionedUser) {
            game.channel.send(`${user.toString()} you must specify somebody to give it to.`);
            return;
        }

        if (!search) {
            game.channel.send(`${user.toString()} you must specify an item.`);
            return;
        }

        const item = await getUserItem(user.id, search);

        if (!item) {
            await game.channel.send(`Eh? You don't have an item called **${search}**.`);
            return;
        }

        await game.channel.send(new Discord.RichEmbed({
            title: `Give Item`,
            fields: [item.asField()],
        }));

        const accept = await game.modules.BASE.acceptPrompt(user, `You sure you want to give this item to ${mentionedUser.toString()}?`);

        if (accept) {
            await game.database.moveItem(user.id, item._id, mentionedUser.id);
            await game.channel.send(`${user.toString()} gave ${mentionedUser.toString()}:`);
            await game.channel.send(new Discord.RichEmbed({
                title: `Item Given`,
                fields: [item.asField()],
            }));
        }
    });

    game.command('sell', async ({ user, args }) => {
        const equipped = await getEquippedItems(user.id);
        const item = await getUserItem(user.id, args);

        if (item) {
            const shopkeep = shopkeepName;
            const buyPrice = Math.floor(item.value * sellValue / 1000) * 1000;

            if (equipped.find((i) => i && i._id === item._id)) {
                await game.channel.send(new Discord.RichEmbed({
                    title: `Sell Item`,
                    fields: [item.asField()],
                }));

                const acceptSellEquipped = await game.modules.BASE.acceptPrompt(user, `You sure you want to sell this? It's currently equipped.`);

                if (!acceptSellEquipped) {
                    return;
                }
            }

            const acceptSale = await game.modules.BASE.acceptPrompt(user, `**${shopkeep}**: I'll take it for ${buyPrice.toLocaleString()}.`);

            if (acceptSale) {
                return await sellItems(shopkeep, buyPrice, user, [item]);
            }
        } else {
            await game.channel.send(`Eh? You don't have an item called **${args}**.`);
        }
    }, 'Sells a single item from your inventory.');

    game.command('junk', async ({ user, args }) => {
        const shopkeep = shopkeepName;
        const equipped = await getEquippedItems(user.id);
        const amount = Math.max(1, parseInt(args) || 10);

        const items = (await game.database.getItems(user.id))
            .filter(({ _id }) => !equipped.find((item) => item && item._id === _id))
            .sort((a, b) => a.value - b.value)
            .slice(0, amount);

        if (items.length === 0) {
            game.channel.send(`**${shopkeep}**: You have nothing of value.`);
            return;
        }

        const itemsValue = items.reduce((value, item) => (value + item.value), 0);
        const buyPrice = Math.floor(itemsValue * sellValue / 1000) * 1000;

        const msg = `${user.toString()}, ${shopkeep} is willing to buy these for ${buyPrice.toLocaleString()} gold. Continue? (All worth ${itemsValue.toLocaleString()} gold)

${items.slice(0, MAX_SELL_DISPLAY).map((item) => `- ${item.toString()} (Worth ${item.value.toLocaleString()} gold)`).join('\n')}
${items.length > MAX_SELL_DISPLAY ?
    `+ ${items.length - MAX_SELL_DISPLAY} more worth ${
        items.slice(MAX_SELL_DISPLAY).reduce((value, item) => (value + item.value), 0).toLocaleString()
    } gold`
: ''}`;

        const accept = await game.modules.BASE.acceptPrompt(user, msg);

        if (accept) {
            await sellItems(shopkeep, buyPrice, user, items);
        }
    }, 'Sells your 10 least valuable items (excluding equipped items). Specify a number to sell that many (e.x. `tr junk 20`).');

    game.command('repair', async ({ user }) => {
        const shopkeep = shopkeepName;
        const equipped = (await getEquippedItems(user.id)).filter(Boolean);
        let price = equipped.reduce((value, item) => {
            return value + ((item.maxDurability - item.durability) / item.maxDurability) * item.value;
        }, 0);
        price /= sellValue;
        price = Math.floor(price / 1000) * 1000;

        if (price > 0) {
            const accept = await game.modules.BASE.acceptPrompt(user, `**${shopkeep}**: I'll repair your items for ${price.toLocaleString()} gold.`);
    
            if (accept) {
                const userInfo = await game.database.getUser(user.id);

                if (userInfo.balance > price) {
                    equipped.forEach((item) => {
                        item.durability = item.maxDurability;
                    });
                    await game.database.updateItems(equipped);
                    await game.database.decrementBalance(user.id, price);
                    await game.channel.send(`**${shopkeep}**: You're all set!`);
                    await game.channel.send(
                        new Discord.RichEmbed({
                            title: `Items Repaired`,
                            fields: equipped.map((item) => item.asField()),
                            color: colors.ORANGE,
                        })
                    );
                } else {
                    await game.channel.send(`*${shopkeep} laughs*\n**${shopkeep}**: Come back when you have enough gold.`);
                }
            }
        } else {
            await game.channel.send(`**${shopkeep}**: You don't have any broken items equipped.`)
        }
    }, 'Repairs your equipped items for a fee.');

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

    const damageItems = async (user) => {
        // Find their equipped stuff.
        const equipped = (await getEquippedItems(user.id)).filter(Boolean);

        // Damage them.
        const damagedItems = equipped.map((item) => {
            const lost = 0 + Math.floor(Math.random() * 5);
            item.durability -= Math.min(item.durability, lost);
            item.lostDurability = lost;
            return item;
        }).filter((item) => item.lostDurability > 0);

        if (damagedItems.length > 0) {
            await game.database.updateItems(damagedItems);
            await game.channel.send(`${user.toString()}, your items have lost durability. Use the \`repair\` command to repair them.`);
            await game.channel.send(
                (
                    new Discord.RichEmbed({
                        title: `Durability Lost`,
                        color: colors.RED,
                        fields: damagedItems.map(item => {
                            const field = item.asField();

                            return {
                                ...field,
                                value: `${field.value}\n\n${item.durability === 0 ? '**:x: broken**' : `**:yellow_circle: lost ${item.lostDurability} durability**`}`
                            };
                        })
                    })
                )
            );
        }
    };

    return {
        giveLoot,
        gainXp,
        userStats,
        monsterStats,
        damageItems,
    };
};

module.exports.moduleId = 'RPG';
