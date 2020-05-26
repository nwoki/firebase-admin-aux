const FirebaseAdmin = require("firebase-admin");
const RedisAux = require('redis-client-aux');
const chalk = require("chalk");
const JSONAPIError = require('jsonapi-serializer').Error;


function customError(code, title, message) {
    return new JSONAPIError({
        status: code,
        title: title,
        detail: message
    });
};

function firebaseError(error) {
    let code = 400;

    if (error.code == "auth/id-token-expired" || error.code == "auth/argument-error"
        || error.code == "auth/invalid-user-token" || error.code == "auth/user-token-expired") {
        code = 401;
    }

    return new JSONAPIError({
        status: code,
        title: error.code,
        detail: error.message
    });
};

let FirebaseAdminAux = (function () {

    /* holds the FirebaseAdminApp instance */
    let app;
    let redisAuxClient;
    let redisCache = false;


    /**
     * PRIVATE INTERNAL AUX FUNCTIONS
     **/
    function createFirebaseApp(projectId, clientEmail, privateKey, databaseUrl) {
        // initialize the firebase app
        app = FirebaseAdmin.initializeApp({
            credential: FirebaseAdmin.credential.cert({
                projectId: projectId,
                clientEmail: clientEmail,
                privateKey: privateKey
            }),
            databaseURL: databaseUrl
        });
    }

    function populateResponseObject(responseObject, decodedTokenObj, bearerToken) {
        responseObject.locals.firebase_uid = decodedTokenObj.user_id;
        responseObject.locals.decoded_token = decodedTokenObj;
        responseObject.locals.bearer_token = bearerToken;
    }

    function requestVerification(bearerToken, res) {
        return new Promise((resolve, reject) => {
            app.auth().verifyIdToken(bearerToken).then((decodedToken) => {
                console.log("[FirebaseAdminAux] %s", JSON.stringify(decodedToken));

                // Stash the token if redis cache is active
                if (redisCache) {
                    redisAuxClient.set("firebase_aux_" + bearerToken, JSON.stringify(decodedToken), 20).then(() => {
                        console.log("ALL SET!");
                        resolve(decodedToken);
                    }).catch((error) => {
                        console.log(error);
                        reject(error);
                    });
                } else {
                    resolve(decodedToken);
                }
            }).catch((error) => {
                console.log(error.toString());
                let datError = firebaseError(error);
                /*return */res.status(datError.errors[0].status).send(datError);
                reject();
            });
        });
    }
    /**************************************************************/


    function initialize(projectId, clientEmail, privateKey, databaseUrl, enableCache = false) {
        if (app == undefined) {
            redisCache = enableCache;

            try {
                // Does the user want to cache info?
                if (redisCache) {
                    // setup the redis connection
                    let redisOptions = {
                        host: process.env.REDIS_URL || 'localhost',
                        port: process.env.REDIS_PORT || 6379,
                        options: {},
                        retry_strategy(options) {
                            console.log(chalk.yellow('[Redis] going to reconnect after: ' + Math.min(options.attempt * 100, 3000)));
                            return Math.min(options.attempt * 100, 3000);
                        }
                    };

                    redisAuxClient = new RedisAux(redisOptions);

                    // handle callbacks
                    redisAuxClient.events.on("ready", () => {
                        console.log(chalk.green('[FirebaseAdminAux:REDIS] Redis is now ready on :', process.env.REDIS_URL));
                        createFirebaseApp(projectId, clientEmail, privateKey, databaseUrl);
                    });
                } else {
                    createFirebaseApp(projectId, clientEmail, privateKey, databaseUrl);
                }
            } catch (err) {
                // Handle the error here.
                console.log("[FirabaseAdminAuth] %s", err);
            }

            console.log(chalk.green("[FirabaseAdminAuth] Initialized"));
        } else {
            console.log(chalk.yellow("[FirabaseAdminAuth] instance already exists"));
        }
    };

    function createUser(userEmail, userPassword) {
        return new Promise((resolve, reject) => {
            app.auth().createUser({
                email: userEmail,
                password: userPassword
            }).then((userRecord) => {
                // See the UserRecord reference doc for the contents of userRecord.
                console.log("[FirabaseAdminAuth] Successfully created new user: %s", userRecord.uid);
                resolve(userRecord);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    function deleteUser(firebaseUid) {
        return new Promise((resolve, reject) => {
            app.auth().deleteUser(firebaseUid)
            .then(() => {
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    };

    function sendPushNotification(title, body, registrationToken) {
        let msg = {
            message: {
                notification: {
                    title: title,
                    body: body
                },
                token: registrationToken
            }
        };

        app.messaging().send(msg)
        .then((response) => {
            // Response is a message ID string.
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            console.log('Error sending message:', error);
        });
    };

    function sendMultiplePushNotifications(title, body, registrationTokens) {
        let msg = {
            message: {
                notification: {
                    title: title,
                    body: body
                },
                tokens: registrationTokens
            }
        };

        app.messaging().sendMulticast(msg)
        .then((response) => {
            // Response is a message ID string.
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            console.log('Error sending message:', error);
        });
    };

    function userExists(userEmail) {
        return new Promise((resolve, reject) => {
            if (!app) {
                reject(new Error("[FirabaseAdminAuth] You must initialize the module first!"));
            } else {
                app.auth().getUserByEmail(userEmail).then((user) => {
                    resolve(user);
                }).catch((error) => {
                    reject(error);
                });
            }
        });
    };

    var validateToken = (req, res, next) => {
        if (!req.headers.authorization) {
            return res.status(401).send(customError(401, "Unauthorized", "Missing authorization"));
        }

        let split = req.headers.authorization.split(' ');

        if (split.length < 2) {
            return res.status(400).send(customError(400, "Bad request", "Malformed authorization"));
        }

        let bearerToken = req.headers.authorization.split(' ')[1];

        if (bearerToken) {
            // check if the token is already stashed
            if (redisCache) {
                console.log("Looking for redis key: %s", "firebase_aux_" + bearerToken);
                redisAuxClient.get("firebase_aux_" + bearerToken).then((decodedToken) => {
                    if (decodedToken) {
                        let decodedObj = JSON.parse(decodedToken);

                        // token is present, already verified and has yet to expire
                        populateResponseObject(res, decodedObj, bearerToken);
                        next();
                    } else {
                        console.log("Token has expired! Request new verification");
                        requestVerification(bearerToken, res).then((decodedToken) => {
                            populateResponseObject(res, decodedToken, bearerToken);
                            next();
                        }).catch((firebaseError) => {
                            console.log(firebaseError);
                        });
                    }
                }).catch((error) => {
                    console.log("CAtch errror");
                    console.log(error);
                });
            } else {
                requestVerification(bearerToken, res).then((decodedToken) => {
                    console.log("NO REDIS");
                    populateResponseObject(res, decodedToken, bearerToken);
                    next();
                }).catch((error) => {
                    console.log(error);
                });
            }
        } else {
            return res.status(400).send(customError(400, "Bad request", "Missing auth token"));
        }
    }

    return {
        createUser: createUser,
        deleteUser: deleteUser,
        sendPushNotification: sendPushNotification,
        sendMultiplePushNotifications: sendMultiplePushNotifications,
        userExists: userExists,
        validateToken: validateToken,
        initialize: initialize
    }
})();

module.exports = FirebaseAdminAux;
