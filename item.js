const capitalize = require('capitalize');
const fantasyNames = require('fantasy-names');

const rarityEmojiMap = {
    normal: '',
    enchanted: ':blue_square:',
    rare: ':yellow_square:',
    legendary: ':purple_square:',
};

const lootTable = [
    ...(new Array(5)).fill('legendary'),
    ...(new Array(10)).fill('rare'),
    ...(new Array(25)).fill('enchanted'),
    ...(new Array(100)).fill('normal'),
];

class Item {
    constructor(props) {
        for (var i in props) {
            this[i] = props[i];
        }
    }

    statsString() {
        const lines = [
            `Level ${this.level} ${capitalize(this.rarity)} ${this.type === 'armor' ? 'Armor' : 'Weapon'}`
        ];

        if (this.stats.ATK) {
            lines.push(`+${this.stats.ATK} ATK`);
        }

        if (this.stats.DEF) {
            lines.push(`+${this.stats.DEF} DEF`);
        }

        return lines.join('\n');
    }

    toString() {
        return `${this.rarity !== 'normal' ? (rarityEmojiMap[this.rarity] + ' ') : ''}${this.name}`;
    }

    asField() {
        return {
            name: this.toString(),
            value: `\`${this.statsString()}\`
*Value: ${this.value.toLocaleString()} gold*`,
            inline: true,
        };
    }
};

Item.generate = (level) => {
    const type = Math.random() > 0.5 ? 'armor' : 'weapon';
    const name = fantasyNames(type === 'armor' ? 'armour' : 'weapons')[0];
    const rarity = lootTable[Math.floor(Math.random() * lootTable.length)];
    let statPoints = 1 + (Math.ceil(level / 4));
    let secondaryStatpoint = 0;
    statPoints = Math.ceil(Math.floor(Math.random() * statPoints / 2) + statPoints / 2);
    let durability = 5 + (Math.ceil(level / 2));

    if (rarity === 'enchanted') {
        statPoints *= 2;
        secondaryStatpoint = Math.floor(Math.random() * statPoints * 0.1);
    }

    if (rarity === 'rare') {
        statPoints *= 3;
        secondaryStatpoint = 1 + (Math.ceil(level / 4));
        secondaryStatpoint = Math.floor(Math.random() * statPoints * 0.25);
    }

    if (rarity === 'legendary') {
        statPoints *= 5;
        secondaryStatpoint = 1 + (Math.ceil(level / 2));
        secondaryStatpoint = Math.floor(Math.random() * statPoints * 0.5);
    }

    const item = {
        name,
        type,
        rarity,
        durability,
        maxDurability: durability,
        level,
        stats: {
            ATK: type === 'weapon' ? statPoints : secondaryStatpoint,
            DEF: type === 'armor' ? statPoints : secondaryStatpoint,
        },
    };

    item.value = Math.floor(Math.pow(item.stats.ATK + item.stats.DEF, 1.25)) * 10000 + Math.floor(Math.random() * 10000);

    return new Item(item);
};

module.exports = Item;
