const Game = require('../game');
const Discord = require('discord.js');
const giphy = require('giphy-api')();
const Sentencer = require('sentencer');
const prettyMs = require('pretty-ms');
const monsters = require('../monsters.json');
const variables = require('../variables');
const Item = require('../item');

const fightProcess = (channel, db, goldResponse, cooldowns, gainXp, userStats, monsterStats, giveLoot) => async (user, monster, level) => {
    const fightState = {
        monster: {
            ...monster,
            // Calculate ATK & DEF for the monster
            ...await monsterStats(level),
        },
        player: {
            ...await userStats(user),
            name: user.username,
        },
    };

    fightState.monster.health = Math.floor((fightState.monster.ATK + fightState.monster.DEF) / 2) * 5;
    fightState.player.health = Math.floor((fightState.player.ATK + fightState.player.ATKBonus + fightState.player.DEF + fightState.player.DEFBonus) / 2) * 5;

    let messageContent = (new Discord.RichEmbed({
        title: `${fightState.player.name} vs. Level ${level} ${fightState.monster.name}`,
    }))
        .addField(
            fightState.player.name,
            'Loading...',
            true
        )
        .addField(
            fightState.monster.name,
            'Loading...',
            true
        )
        .addBlankField(true)
        .addField(
            `Damage Dealt ${fightState.player.name}`,
            'Loading...',
            true
        )
        .addField(
            `Damage Blocked ${fightState.monster.name}`,
            'Loading...',
            true
        )
        .addBlankField(true)
        .addField(
            `Damage Blocked ${fightState.player.name}`,
            'Loading...',
            true
        )
        .addField(
            `Damage Dealt ${fightState.monster.name}`,
            'Loading...',
            true
        )
        .addBlankField(true)
        .addField(
            'Match Log',
            'Waiting...'
        );

    const interactiveMessage = await channel.send(messageContent);
    let log = [];
    let playerTurn = false;
    let playerDealt = 0;
    let playerBlock = 0;
    let monsterDealt = 0;
    let monsterBlock = 0;

    await new Promise((resolve) => {
        let stop = false;

        (async () => {
            while (!stop) {
                interactiveMessage.edit(messageContent);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        })();

        const interval = setInterval(async () => {
            if (fightState.monster.health > 0 && fightState.player.health > 0) {
                playerTurn = !playerTurn;
                const criticalHit = Math.random() < 0.05;

                if (playerTurn) {
                    let playerDamage = Math.floor(Math.random() * (fightState.player.ATK / 2 + fightState.player.ATKBonus) + Math.floor(fightState.player.ATK / 2));
                    const monsterDefense = Math.floor(Math.random() * (fightState.monster.DEF * 1) + Math.floor(fightState.monster.DEF * 0.25));

                    if (criticalHit) {
                        playerDamage *= 2;
                    }

                    playerDealt += playerDamage;
                    monsterBlock += Math.min(monsterDefense, playerDamage);

                    fightState.monster.health -= Math.max(playerDamage - monsterDefense, 0);
                    log.push(`${fightState.player.name} hits ${fightState.monster.name} for ${playerDamage}${criticalHit ? '*' : ''} (-${monsterDefense}) damage!`);
                } else {
                    let monsterDamage = Math.floor(Math.random() * (fightState.monster.ATK / 2) + Math.floor(fightState.monster.ATK / 2));
                    const playerDefense = Math.floor(Math.random() * ((fightState.player.DEF + fightState.player.DEFBonus) * 1) + Math.floor((fightState.player.DEF + fightState.player.DEFBonus) * 0.25));

                    if (criticalHit) {
                        monsterDamage *= 2;
                    }

                    monsterDealt += monsterDamage;
                    playerBlock += Math.min(playerDefense, monsterDamage);

                    fightState.player.health -= Math.max(monsterDamage - playerDefense, 0);
                    log.push(`${fightState.monster.name} hits ${fightState.player.name} for ${monsterDamage}${criticalHit ? '*' : ''} (-${playerDefense}) damage!`);
                }

                fightState.monster.health = Math.max(fightState.monster.health, 0);
                fightState.player.health = Math.max(fightState.player.health, 0);

                messageContent.fields[0].value = `ATK: ${fightState.player.ATK} (+${fightState.player.ATKBonus})\nDEF: ${fightState.player.DEF} (+${fightState.player.DEFBonus})\nHealth: ${fightState.player.health}`;
                messageContent.fields[1].value = `ATK: ${fightState.monster.ATK}\nDEF: ${fightState.monster.DEF}\nHealth: ${fightState.monster.health}`;
                messageContent.fields[3].value = playerDealt.toLocaleString();
                messageContent.fields[4].value = monsterBlock.toLocaleString();
                messageContent.fields[6].value = playerBlock.toLocaleString();
                messageContent.fields[7].value = monsterDealt.toLocaleString();
                messageContent.fields[9].value = log.slice(log.length - 10).join('\n');
                cooldowns.cooldown(user.id, 'fight', 2 * 60 * 1000);
            } else {
                stop = true;
                clearInterval(interval);
                resolve();
            }
        }, 50);
    });

    let playerWin = fightState.player.health > 0;

    if (playerWin) {
        // Player wins.
        log.push(`${fightState.player.name} is victorious!`);
    } else {
        // Monster wins.
        log.push(`${fightState.player.name} died.`);
    }

    messageContent.fields[9].value = log.slice(log.length - 10).join('\n');
    interactiveMessage.edit(messageContent);

    const goldReward = Math.floor(Math.random() * level * 1000 / 2) + Math.floor(level * 1000 / 2);
    const xpReward = Math.floor(Math.random() * level * 1000 / 2) + Math.floor(level * 1000 / 2);
    const dbUser = await db.getUser(user.id);

    if (playerWin) {
        await db.incrementKills(user.id);
        await db.incrementBalance(user.id, goldReward);

        channel.send(
            (
                new Discord.RichEmbed({
                    title: log[log.length - 1],
                })
                    .addField(
                        'Gold Earned',
                        goldReward.toLocaleString(),
                        true,
                    )
                    .addField(
                        'XP Earned',
                        xpReward.toLocaleString(),
                        true,
                    )
            )
        );

        // Create loot.
        const lootBox = [];

        for (let i = 0; i < Math.ceil(level / 10); i++) {
            lootBox.push(Item.generate(level));

            while (Math.random() < 0.05) {            
                lootBox.push(Item.generate(level));
            }
        }

        await giveLoot(user, lootBox);
        await gainXp(user, xpReward);
    } else {
        await db.incrementDeaths(user.id);
        await db.decrementBalance(user.id, goldReward);
        const cd = fightState.player.level * 60000 * Math.random() + 60000;
        cooldowns.cooldown(user.id, 'fight', cd);

        channel.send(
            (
                new Discord.RichEmbed({
                    title: log[log.length - 1],
                })
                    .addField(
                        'Gold Lost',
                        (Math.min(goldReward, dbUser.balance)).toLocaleString(),
                        true,
                    )
                    .addField(
                        'Cooldown',
                        prettyMs(cd),
                        true,
                    )
                    .addField(
                        'Items Destroyed',
                        'none',
                    )
            )
        );
    }

    await goldResponse(user);
};

const chanceTable = [
    ...(new Array(20)).fill(0.0625),
    ...(new Array(20)).fill(0.125),
    ...(new Array(20)).fill(0.25),
    ...(new Array(20)).fill(0.5),
    ...(new Array(10)).fill(1),
    ...(new Array(10)).fill(2),
    /*
    ...(new Array(10)).fill(3),
    ...(new Array(10)).fill(4),
    ...(new Array(10)).fill(5),
    ...(new Array(10)).fill(6),
    ...(new Array(10)).fill(7),
    ...(new Array(10)).fill(8),
    ...(new Array(10)).fill(9),
    ...(new Array(10)).fill(10),
    ...(new Array(5)).fill(11),
    ...(new Array(5)).fill(12),
    ...(new Array(5)).fill(13),
    ...(new Array(5)).fill(14),
    ...(new Array(5)).fill(15),
    ...(new Array(5)).fill(16),
    ...(new Array(5)).fill(17),
    ...(new Array(5)).fill(18),
    ...(new Array(5)).fill(19),
    ...(new Array(5)).fill(20),
    ...(new Array(5)).fill(21),
    ...(new Array(2)).fill(22),
    ...(new Array(2)).fill(23),
    ...(new Array(2)).fill(24),
    ...(new Array(2)).fill(25),
    ...(new Array(2)).fill(30),
    */
];

/**
 * @param {Game} game
 */
module.exports = (game) => {
    const fight = fightProcess(
        game.channel,
        game.database,
        game.modules.BASE.goldResponse,
        game.cooldowns,
        game.modules.RPG.gainXp,
        game.modules.RPG.userStats,
        game.modules.RPG.monsterStats,
        game.modules.RPG.giveLoot
    );

    const fightCooldownMessage = (user) => async (time) => {
        game.channel.send(`${user.toString()}, you're too worn out to fight. Try again after **${time}**.`);
    };

    const fightPrompt = async () => {
        // Determine appropriate monster challenge level.
        const challengeLevel = chanceTable[Math.floor(Math.random() * chanceTable.length)];
        const applicableMonsters = monsters.filter(({ challenge }) => challenge == challengeLevel);
        const monster = applicableMonsters[Math.floor(Math.random() * applicableMonsters.length)];
        const { data: { image_url: gif } = { image_url: 'https://media.giphy.com/media/3o6wrdG8vt4X86Pauc/giphy.gif' } } = await giphy.random('monster');
        const level = Math.floor(Math.random() * 5 + 1);
        let attachment = new Discord.RichEmbed({
            title: Sentencer.make(`A ⭐ level ${level} ⭐ {{ adjective }} {{ adjective }} ${monster.name} appeared! Press the 🗡️ to fight it!`),
        });

        attachment = attachment.setImage(gif);

        const { user, message } = await game.modules.BASE.reactionPrompt(
            attachment,
            ['🗡️'],
            60 * 1000,
            (reaction, user) => reaction.emoji.name === '🗡️' &&
                !game.cooldowns.checkCooldown(user.id, 'fight', fightCooldownMessage(user))
        );

        if (user) {
            fight(user, monster, level);
        } else {
            await message.delete();
        }
    };

    game.tick(() => {
        if (Math.random() > 0.75) {
            fightPrompt();
        }
    });

    game.command('fight', ({ user }) => {
        if (variables.isTestEnvironment) {
            fightPrompt();
        }
    });
};

module.exports.moduleId = 'FIGHT';
