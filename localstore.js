//
// LocalStorage (in Memory with Redis)
//
var prefs = require("./prefs");
const redis = require("redis")
const client = redis.createClient()
//
// Name space
//
module.exports = {
    // format date to YYYYMMDDmmss
    dateFormat: function(pDate) {
        function pad2(number) {
            return (number < 10 ? '0' : '') + number;
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
    dateTimeFormat: function(pDate) {
        function pad2(number) {
            return (number < 10 ? '0' : '') + number;
        }
        pDate = new Date();
        var yyyy = pDate.getFullYear().toString();
        var MM = pad2(pDate.getMonth() + 1);
        var dd = pad2(pDate.getDate());
        var hh = pad2(pDate.getHours());
        var mm = pad2(pDate.getMinutes());

        return dd + '.' + MM + '.' + yyyy + ' ' + hh + ':' + mm;
    },
    // Save Client Session in user DB
    saveUserSession: function(pUserId, pSocketRoom, pSocketSessionid, callback) {
        var lDate = new Date();
        var lDateFormat = module.exports.dateFormat(lDate);

        const redisKey = `user:${pUserId.toUpperCase()}:${pSocketRoom.toUpperCase()}`

        const sessionData = {
            userId: pUserId.toUpperCase(),
            socketRoom: pSocketRoom.toUpperCase(),
            socketSessionId: pSocketSessionid,
            created: lDateFormat
        }

        client.set(redisKey, JSON.stringify(sessionData), (err, res) => {

            if (err) {
                prefs.doLog('REDIS - Insert users ERROR', err);
                callback(err)
            } else {
                prefs.doLog("REDIS - Insert users DONE")
                callback(res)
            }
        })
    },
    // Get all User Sessions from user DB
    getUserSession: function(pUserid, pSocketRoom, callback) {
        let redisKey = ""

        if (pUserid.toUpperCase() === 'ALL' && pSocketRoom.toUpperCase() === 'PUBLIC') {
            redisKey = `user:${pSocketRoom.toUpperCase()}`
        } else {
            redisKey = `users:${pUserid.toUpperCase()}:${pSocketRoom.toUpperCase()}`
        }

        client.get(redisKey, (err, res) => {
            if (err) {
                prefs.doLog('REDIS - Get users Session Error', err);
                callback(err)
            } else {
                const session = res ? JSON.parse(res): null
                prefs.doLog('Redis - Select user session DONE')
                callback(session)
            }
        })
    },
    // Delete Sessions older than 2 hours
    deleteOldSessions: function(callback) {
        var lDate = new Date();
        lDate = lDate.setHours(lDate.getHours() - 2);
        var lDateFormat = module.exports.dateFormat(lDate);

        client.keys("user:*", (err, key) => {
            if (err) {
                prefs.doLog("REDIS - Get key ERROR", err)
                callback(err)
                return
            }

            const keyToDelete = key.filter(k => {
                const sessionCreatedDate = k.split(":")[2]
                return sessionCreatedDate < lDateFormat
            })

            if (keyToDelete.length > 0) {
                client.del(keyToDelete, (delErr, res) => {
                    if (delErr) {
                        prefs.doLog("REDIS - delete Old session ERROR", delErr)
                        callback(delErr)
                    } else {
                        prefs.doLog("REDIS - delete Old Session DONE")
                        callback(res)
                    }
                })
            } else {
                prefs.doLog("REDIS - No Old SESSION TO Delete")
                callback([])
            }
        })
    },
    // Get DB stats
    getDbStats: function(callback) {
        client.keys('users:*', (err, keys) => {
            if (err) {
                console.error('Redis - Get keys ERROR', err);
                callback(err);
                return;
            }
            const pipeline = client.pipeline();
            keys.forEach((key) => {
                pipeline.hget(key, 'room');
            });

            pipeline.exec((pipelineErr, results) => {
                if (pipelineErr) {
                    prefs.doLog('Redis - Pipeline execution ERROR', pipelineErr);
                    callback(pipelineErr);
                    return;
                }
                // Sir this object represents the count of occurrences for each unique 'room' value ok?
                const stats = results.reduce((acc, [room]) => {
                    acc[room] = (acc[room] || 0) + 1;
                    return acc;
                }, {});

                prefs.doLog('Redis - Select DB stats DONE');

                callback(stats);
            });
        });
    }
};
