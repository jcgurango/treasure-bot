const db = require('node-localdb');
const Sentencer = require('sentencer');
const Item = require('./item');

module.exports = (prefix = 'default') => {
    const users = new db(`.data/${prefix}-users.json`);
    const userItems = new db(`.data/${prefix}-userItems.json`);
    const userStats = new db(`.data/${prefix}-userStats.json`);

    const getUser = async (userId) => {
        // First find the user.
        let user = await users.findOne({
            id: userId,
        });

        // If no user is found...
        if (!user) {
            user = await users.insert({
                id: userId,
                balance: 0,
                kills: 0,
                deaths: 0,
            });
        }

        return user;
    };

    const getUserStats = async (userId) => {
        // First find the user.
        const user = await getUser(userId);

        // Find the user's stats.
        let stats = await userStats.findOne({
            userId: user.id,
        });

        // If no stats are found...
        if (!stats) {
            stats = await userStats.insert({
                userId,
                title: Sentencer.make('{{ adjective }} {{ noun }} of {{ noun }}'),
                level: 1,
                XP: 0,
                ATK: 5,
                DEF: 5,
            });
        }

        return stats;
    };

    const updateUserStats = async (userId, updateStats) => {
        const stats = await getUserStats(userId);

        return await userStats.update({
            _id: stats._id,
        }, {
            ...stats,
            ...updateStats,
        });
    };

    const setUserStatsXP = async (userId, XP) => {
        const stats = await getUserStats(userId);

        return await userStats.update({
            _id: stats._id,
        }, {
            ...stats,
            XP,
        });
    };

    const setUserStatsLevel = async (userId, level) => {
        const stats = await getUserStats(userId);

        return await userStats.update({
            _id: stats._id,
        }, {
            ...stats,
            level,
        });
    };

    const getBalance = async (userId) => {
        // First find the user.
        const user = await getUser(userId);

        return user.balance;
    };

    const incrementKills = async (userId) => {
        // First find the user.
        const user = await getUser(userId);

        // Add to the user's balance.
        await users.update({
            id: userId,
        }, {
            ...user,
            kills: user.kills + 1,
        });

        return user.balance;
    };

    const incrementDeaths = async (userId) => {
        // First find the user.
        const user = await getUser(userId);

        // Add to the user's balance.
        await users.update({
            id: userId,
        }, {
            ...user,
            deaths: user.deaths + 1,
        });

        return user.balance;
    };

    const incrementBalance = async (userId, amount) => {
        // First find the user.
        const user = await getUser(userId);

        // Add to the user's balance.
        await users.update({
            id: userId,
        }, {
            ...user,
            balance: user.balance + amount,
        });

        return user.balance;
    };

    const decrementBalance = async (userId, amount) => {
        // First find the user.
        const user = await getUser(userId);

        // Add to the user's balance.
        await users.update({
            id: userId,
        }, {
            ...user,
            balance: Math.max(user.balance - amount, 0),
        });

        return user.balance;
    };

    const setBalance = async (userId, amount) => {
        // First find the user.
        const user = await getUser(userId);

        // Add to the user's balance.
        await users.update({
            id: userId,
        }, {
            ...user,
            balance: amount,
        });

        return user.balance;
    };

    const getItems = async (userId) => {
        return await userItems.find({
            user: userId,
        }).map((item) => new Item(item));
    };

    const giveItem = async (userId, item) => {
        return await userItems.insert({
            user: userId,
            ...item,
        });
    };

    const moveItem = async (userId, itemId, newUserId) => {
        const item = await userItems.findOne({ _id: itemId });

        return await userItems.update({
            _id: itemId,
            user: userId,
        }, {
            ...item,
            user: newUserId,
        });
    };

    const removeItems = async (userId, items = []) => {
        return Promise.all(
            items.map((item) => userItems.remove({ user: userId, _id: item }))
        );
    };

    const updateItems = async (items = []) => {
        await Promise.all(items.map(async (item) => {
            if (item.durability === 0) {
                return await userItems.remove({
                    _id: item._id,
                });
            }

            const retrievedItem = await userItems.findOne({
                _id: item._id,
            });

            await userItems.update({
                _id: item._id,
            }, {
                ...retrievedItem,
                ...item,
            });
        }));
    };

    const getUserIds = async () => {
        return (await users.find({ })).map(({ id }) => id);
    };

    return {
        getUser,
        getUserStats,
        updateUserStats,
        setUserStatsXP,
        setUserStatsLevel,
        getBalance,
        incrementKills,
        incrementDeaths,
        incrementBalance,
        decrementBalance,
        setBalance,
        getItems,
        giveItem,
        moveItem,
        removeItems,
        users,
        userItems,
        updateItems,
        getUserIds,
    };
};