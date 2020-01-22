const Game = require('../game');
const Discord = require('discord.js');
const giphy = require('giphy-api')();
const Sentencer = require('sentencer');
const prettyMs = require('pretty-ms');
const monsters = require('../monsters.json');

const fightProcess = (channel, db, goldResponse, cooldowns) => async (user, monster) => {
    const fightState = {
        monster: {
            ...monster,
            // Calculate ATK & DEF for the monster
            ATK: Math.floor(monster.challenge * Math.random() + monster.challenge) * 5 + 5,
            DEF: Math.floor(monster.challenge * Math.random() + monster.challenge) * 5 + 5
        },
        player: {
            ATK: 10,
            ATKBonus: 10,
            DEF: 10,
            DEFBonus: 10,
            name: user.username,
        },
    };

    fightState.monster.health = Math.floor((fightState.monster.ATK + fightState.monster.DEF) / 2) * 5;
    fightState.player.health = Math.floor((fightState.player.ATK + fightState.player.ATKBonus + fightState.player.DEF + fightState.player.DEFBonus) / 2) * 5;

    let messageContent = (new Discord.RichEmbed({
        title: `${fightState.player.name} vs. ${fightState.monster.name}`,
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
        .addField(
            'Match Log',
            'Waiting...'
        );

    const interactiveMessage = await channel.send(messageContent);
    let log = [];
    let playerTurn = false;

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

                    if (criticalHit) {
                        playerDamage *= 2;
                    }

                    fightState.monster.health -= Math.max(playerDamage - fightState.monster.DEF, 0);
                    log.push(`${fightState.player.name} hits ${fightState.monster.name} for ${playerDamage}${criticalHit ? '*' : ''} (-${fightState.monster.DEF}) damage!`);
                } else {
                    let monsterDamage = Math.floor(Math.random() * (fightState.monster.ATK / 2) + Math.floor(fightState.monster.ATK / 2));

                    if (criticalHit) {
                        monsterDamage *= 2;
                    }

                    fightState.player.health -= Math.max(monsterDamage - fightState.player.DEF - fightState.player.DEFBonus, 0);
                    log.push(`${fightState.monster.name} hits ${fightState.player.name} for ${monsterDamage}${criticalHit ? '*' : ''} (-${fightState.player.DEF}) damage!`);
                }

                fightState.monster.health = Math.max(fightState.monster.health, 0);
                fightState.player.health = Math.max(fightState.player.health, 0);

                messageContent.fields[0].value = `ATK: ${fightState.player.ATK} (+${fightState.player.ATKBonus})\nDEF: ${fightState.player.DEF} (+${fightState.player.DEFBonus})\nHealth: ${fightState.player.health}`;
                messageContent.fields[1].value = `ATK: ${fightState.monster.ATK}\nDEF: ${fightState.monster.DEF}\nHealth: ${fightState.monster.health}`;
                messageContent.fields[2].value = log.slice(log.length - 10).join('\n');
                cooldowns.cooldown(user.id, 'fight', 2 * 60 * 1000);
            } else {
                stop = true;
                clearInterval(interval);
                resolve();
            }
        }, 250);
    });

    let playerWin = fightState.player.health > 0;

    if (playerWin) {
        // Player wins.
        log.push(`${fightState.player.name} is victorious!`);
    } else {
        // Monster wins.
        log.push(`${fightState.player.name} died.`);
    }

    messageContent.fields[2].value = log.slice(log.length - 10).join('\n');
    interactiveMessage.edit(messageContent);

    const goldReward = Math.floor(Math.random() * fightState.monster.challenge * 1000 / 2) + Math.floor(fightState.monster.challenge * 1000 / 2);
    const xpReward = Math.floor(Math.random() * fightState.monster.challenge * 100 / 2) + Math.floor(fightState.monster.challenge * 100 / 2);

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
                    /*
                    .addField(
                        'XP Earned',
                        xpReward.toLocaleString(),
                        true,
                    )
                    */
                    .addField(
                        'Item Rewards',
                        'none',
                    )
            )
        );
    } else {
        await db.incrementDeaths(user.id);
        await db.decrementBalance(user.id, goldReward);
        const cd = xpReward * 1000 + 5 * 60 * 1000;
        cooldowns.cooldown(user.id, 'fight', cd);

        channel.send(
            (
                new Discord.RichEmbed({
                    title: log[log.length - 1],
                })
                    .addField(
                        'Gold Lost',
                        goldReward.toLocaleString(),
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

/**
 * @param {Game} game
 */
module.exports = (game) => {
    const fight = fightProcess(game.channel, game.database, game.modules.BASE.goldResponse, game.cooldowns);

    const fightCooldownMessage = (user) => async (time) => {
        game.channel.send(`${user.toString()}, you're too worn out to fight. Try again after **${time}**.`);
    };

    const fightPrompt = async () => {
        const monster = monsters[Math.floor(Math.random() * monsters.length)];
        const { data: { image_url: gif } = { image_url: 'https://media.giphy.com/media/3o6wrdG8vt4X86Pauc/giphy.gif' } } = await giphy.random('monster');
        let attachment = new Discord.RichEmbed({
            title: Sentencer.make(`A level ${Math.floor(monster.challenge * 5) + Math.floor(Math.random() * 10)} {{ adjective }} {{ adjective }} ${monster.name} appeared! Press the 🗡️ to fight it!`),
        });

        attachment = attachment.setImage(gif);

        const { user, message } = await game.modules.BASE.reactionPrompt(
            attachment,
            ['🗡️'],
            (reaction, user) => reaction.emoji.name === '🗡️' &&
                !game.cooldowns.checkCooldown(user.id, 'fight', fightCooldownMessage(user))
        );

        if (user) {
            fight(user, monster);
        } else {
            message.delete();
        }
    };

    game.tick(() => {
        if (Math.random() < 0.5) {
            //fightPrompt();
        }
    });

    game.command('fight', ({ user }) => {
        if (user.id === '220193117016424458') {
            fightPrompt();
        }
    });
};