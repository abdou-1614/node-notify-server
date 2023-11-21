
    // SAVE SESSION 

    const lDate = new Date();
    const lDateFormat = module.exports.dateFormat(lDate);
alasql.promise("INSERT INTO users VALUES (UPPER('" + pUserId + "'),UPPER('" + pSocketRoom + "'),'" + pSocketSessionid + "','" + lDateFormat + "')")
.then(function(res) {
    // reindex users table indexes
    alasql("REINDEX i_users_userid");
    alasql("REINDEX i_users_room");
    alasql("REINDEX i_users_created");
    // logging
    prefs.doLog('alasql - Insert users DONE');
    // callback
    callback(res);
}).catch(function(err) {
    // logging
    prefs.doLog('alasql - Insert users ERROR', err);
    // callback
    callback(err);
});


    // Get User Session

    var sqlString = "";
    // all users public
    if (pUserid.toUpperCase() === 'ALL' && pSocketRoom.toUpperCase() === 'PUBLIC') {
        sqlString = "SELECT session FROM users WHERE room = UPPER('" + pSocketRoom + "')";
        // specific user and room
    } else {
        sqlString = "SELECT session FROM users WHERE userid = UPPER('" + pUserid + "') AND room = UPPER('" + pSocketRoom + "')";
    }
    alasql.promise(sqlString)
        .then(function(res) {
            // logging
            prefs.doLog('alasql - Select user session DONE');
            // callback
            callback(res);
        }).catch(function(err) {
            // logging
            prefs.doLog('alasql - Select user session ERROR', err);
            // callback
            callback(err);
        });


        // DELETE OLD SESSION 

        var lDate = new Date();
        lDate = lDate.setHours(lDate.getHours() - 2);
        var lDateFormat = module.exports.dateFormat(lDate);
        alasql.promise("DELETE FROM users WHERE created < '" + lDateFormat + "'")
            .then(function(res) {
                // reindex users table
                alasql("REINDEX i_users_userid");
                alasql("REINDEX i_users_room");
                alasql("REINDEX i_users_created");
                // logging
                prefs.doLog('alasql - Delete users DONE');
                // callback
                callback(res);
            }).catch(function(err) {
                // logging
                prefs.doLog('alasql - Delete ERROR', err);
                callback(err);
            });


            // GET DB STATES


            alasql.promise("SELECT COUNT(*) AS counter, room FROM users GROUP BY room")
            .then(function(res) {
                // logging
                prefs.doLog('alasql - Select DB stats DONE');
                // callback
                callback(res);
            }).catch(function(err) {
                // logging
                prefs.doLog('alasql - Select DB stats ERROR', err);
                // callback
                callback(err);
            });