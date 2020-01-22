const db = require('node-localdb');
const items = require('./items.json');

module.exports = (prefix = 'default') => {
    const users = new db(`.data/${prefix}-users.json`);
    const userItems = new db(`.data/${prefix}-userItems.json`);

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

    const getBalance = async (userId) => {
        // First find the user.
        const user = await getUser(userId);

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
        return (await userItems.find({
            user: userId,
        })).map(({ item, ...rest }) => ({
            item: items[item],
            ...rest,
        }));
    };

    return {
        getUser,
        getBalance,
        incrementBalance,
        setBalance,
        getItems,
        users,
        userItems,
    };
};