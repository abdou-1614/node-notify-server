const Redis = require("ioredis");
const redis = new Redis(); // Default to 127.0.0.1:6379, you can pass your own config
const prefs = require("./prefs");

module.exports = {
    // format date to YYYYMMDDmmss
    dateFormat: function (pDate) {
        function pad2(number) {
            return (number < 10 ? "0" : "") + number;
        }
        pDate = new Date();
        var yyyy = pDate.getFullYear().toString();
        var MM = pad2(pDate.getMonth() + 1);
        var dd = pad2(pDate.getDate());
        var hh = pad2(pDate.getHours());
        var mm = pad2(pDate.getMinutes());
        var ss = pad2(pDate.getSeconds());

        return yyyy + MM + dd + hh + mm + ss;
    },
    // format date to DD.MM.YYYY HH24:MI
    dateTimeFormat: function (pDate) {
        function pad2(number) {
            return (number < 10 ? "0" : "") + number;
        }
        pDate = new Date();
        var yyyy = pDate.getFullYear().toString();
        var MM = pad2(pDate.getMonth() + 1);
        var dd = pad2(pDate.getDate());
        var hh = pad2(pDate.getHours());
        var mm = pad2(pDate.getMinutes());

        return dd + "." + MM + "." + yyyy + " " + hh + ":" + mm;
    },
    // Save Client Session in Redis
    saveUserSession: function (userId, socketRoom, socketSessionId, callback) {
        const userKey = `user:${userId.toUpperCase()}`;
        const roomKey = `room:${socketRoom.toUpperCase()}`;
        const sessionKey = `session:${socketSessionId}`;
        const sessionListKey = `sessions:${userId.toUpperCase()}`; // Key for the list of sessions
        const now = Date.now();

        // Start a transaction
        const pipeline = redis.pipeline();

        // Add new session to the list of sessions for this user
        pipeline.rpush(
            sessionListKey,
            JSON.stringify({
                room: socketRoom.toUpperCase(),
                session: socketSessionId,
                created: now,
            })
        );

        // Store session data within a hash
        pipeline.hset(userKey, "room", socketRoom.toUpperCase());
        pipeline.hset(userKey, "session", socketSessionId);
        pipeline.hset(userKey, "created", now);

        // Add to room set for easy retrieval
        pipeline.sadd(roomKey, userId.toUpperCase());

        // Set a session key for easy session retrieval/deletion
        pipeline.set(sessionKey, userId.toUpperCase());

        // Execute the transaction
        pipeline.exec((err, results) => {
            if (err) {
                prefs.doLog("Redis - Insert user ERROR", err);
                return callback(err);
            }
            prefs.doLog("Redis - Insert user DONE");
            callback(null, results);
        });
    },

    // Get all User Sessions from Redis
    // Get all User Sessions from Redis
    getUserSession: function (userId, socketRoom, callback) {
        const userKey = `user:${userId.toUpperCase()}`;
        const roomKey = `room:${socketRoom.toUpperCase()}`;
        const sessionListKey = `sessions:${userId.toUpperCase()}`; // Key for the list of sessions

        if (
            userId.toUpperCase() === 'ALL' &&
            socketRoom.toUpperCase() === 'PUBLIC'
        ) {
            // Retrieve all sessions in the room
            redis.smembers(roomKey, (err, userIds) => {
                if (err) {
                    prefs.doLog('ioredis - Select user sessions ERROR', err);
                    return callback(err);
                }

                // Fetch sessions for each user
                const sessionPromises = userIds.map((id) => {
                    return new Promise((resolve, reject) => {
                        redis.lrange(`sessions:${id}`, 0, -1, (error, sessions) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(sessions.map((session) => JSON.parse(session)));
                            }
                        });
                    });
                });

                Promise.all(sessionPromises)
                    .then((results) => {
                        prefs.doLog('ioredis - Select user sessions DONE');
                        callback(null, results);
                    })
                    .catch((error) => {
                        prefs.doLog('ioredis - Select user sessions ERROR', error);
                        callback(error);
                    });
            });
        } else {
            // Get sessions for a specific user
            client.lrange(sessionListKey, 0, -1, (err, sessions) => {
                if (err) {
                    prefs.doLog('ioredis - Select user session ERROR', err);
                    return callback(err);
                }

                const parsedSessions = sessions.map((session) => JSON.parse(session));
                prefs.doLog('ioredis - Select user session DONE');
                callback(null, parsedSessions);
            });
        }
    },


    // Delete Sessions older than 2 hours
    deleteOldSessions: function (callback) {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000; // <== Sir This Calculate timestamp for two hours ago OK?

        // Sir We fetch all user keys using client.keys OK?
        redis.keys("user:*").then((userKeys) => {
            // Iterate over user keys
            userKeys.forEach(async (userKey) => {
                try {
                    // Sir client.hget to fetch the creation timestamp from the user hash OK?
                    const createdTimestamp = await redis.hget(userKey, "created");

                    // Check if the session is older than two hours
                    if (createdTimestamp < twoHoursAgo) {
                        // And Here Sir If yes, use zremrangebyscore to remove the session from the user's list of sessions.
                        const zremRes = await redis.zremrangebyscore(userKey, '-inf', twoHoursAgo);
                        prefs.doLog("ioredis - Delete Old Sessions DONE");
                        callback(null, zremRes);
                    } else {
                        prefs.doLog("ioredis - No Old Sessions To Delete");
                        callback([]);
                    }
                } catch (error) {
                    prefs.doLog("ioredis - Error processing user key", error);
                    callback(error);
                }
            });
        }).catch((err) => {
            prefs.doLog("ioredis - Get user keys ERROR", err);
            callback(err);
        });
    },
    // Get DB stats
    getDbStats: function (callback) {
        redis.keys('user:*').then((userKeys) => {
            const pipeline = redis.pipeline();

            // Iterate over user keys
            userKeys.forEach((userKey) => {
                // Fetch the user's room set
                pipeline.smembers(userKey + ':rooms');
            });

            return pipeline.exec();
        }).then((results) => {
            // This object represents the count of occurrences for each unique 'room' value
            const stats = {};

            // Iterate over pipeline results
            results.forEach(([err, roomSet]) => {
                if (!err) {
                    // Count occurrences of each room
                    roomSet.forEach((room) => {
                        stats[room] = (stats[room] || 0) + 1;
                    });
                }
            });

            prefs.doLog('ioredis - Select DB stats DONE');

            callback(stats);
        }).catch((err) => {
            prefs.doLog('ioredis - Get keys ERROR', err);
            callback(err);
        });
    }
}
