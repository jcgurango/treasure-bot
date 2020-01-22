const prettyMs = require('pretty-ms');
const cooldowns = { };

const cooldown = (id, action, time) => {
    cooldowns[`${id}|${action}`] = Date.now() + time;
};

const onCooldown = (id, action) => {
    return cooldowns[`${id}|${action}`] && cooldowns[`${id}|${action}`] > Date.now();
};

const cooldownTime = (id, action) => {
    return prettyMs(cooldowns[`${id}|${action}`] - Date.now());
};

const checkCooldown = (id, action, callback) => {
    if (onCooldown(id, action)) {
        callback(cooldownTime(id, action));
        return true;
    }

    return false;
};

module.exports = {
    cooldown,
    onCooldown,
    cooldownTime,
    checkCooldown,
};