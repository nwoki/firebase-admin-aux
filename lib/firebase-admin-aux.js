const FirebaseAdmin = require("firebase-admin");
// const Logger = require('./logger.js');
// const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
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

    if (error.code == "auth/id-token-expired") {
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

    function initialize(projectId, clientEmail, privateKey, databaseUrl) {
        if (app == undefined) {
            try {
                // initialize the firebase app
                app = FirebaseAdmin.initializeApp({
                    credential: FirebaseAdmin.credential.cert({
                        projectId: projectId,
                        clientEmail: clientEmail,
                        privateKey: privateKey
                    }),
                    databaseURL: databaseUrl
                });
            } catch (err) {
                // Handle the error here.
                console.log("[FirabaseAdminAuth] %s", err);
            }

            console.log("[FirabaseAdminAuth] Initialized");
        } else {
            console.log("[FirabaseAdminAuth] instance already exists");
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
//             return res.boom.unauthorized("Missing authorization");
            return res.status(401).send(customError(401, "Unauthorized", "Missing authorization"));
        }

        let split = req.headers.authorization.split(' ');

        if (split.length < 2) {
//             return res.boom.badRequest("Malformed authorization");
            return status(400).send(customError(400, "Bad request", "Malformed authorization"));
        }

        let bearerToken = req.headers.authorization.split(' ')[1];

        // TODO reinstate dev backdoor auth
        /*if (bearerToken == process.env.DEVELOPER_AUTH_TOKEN) {
            res.locals.bearerToken = bearerToken;
            next();
        } else*/ if (bearerToken) {
//             getApp().auth().verifyIdToken(bearerToken).then((decodedToken) => {
            app.auth().verifyIdToken(bearerToken).then((decodedToken) => {
                console.log("[FirebaseAdminAux] %s", JSON.stringify(decodedToken));
                res.locals.firebase_uid = decodedToken.user_id;
                res.locals.decoded_token = decodedToken;
                res.locals.bearer_token = bearerToken;
                next();
            }).catch((error) => {
                console.log(error.toString());
                let datError = firebaseError(error);
                res.status(datError.errors[0].status).send(datError);
            });
        } else {
//             return res.boom.badRequest("missing auth token");
            return res.status(400).send(customError(400, "Bad request", "Missing auth token"));
        }
    }

    return {
        createUser: createUser,
        sendPushNotification: sendPushNotification,
        sendMultiplePushNotifications: sendMultiplePushNotifications,
        userExists: userExists,
        validateToken: validateToken,
        initialize: initialize
    }
})();

module.exports = FirebaseAdminAux;
