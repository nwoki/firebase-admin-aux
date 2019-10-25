const FirebaseAdmin = require("firebase-admin");
// const Logger = require('./logger.js');
// const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

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
            return res.boom.unauthorized("Missing authorization");
        }

        let split = req.headers.authorization.split(' ');

        if (split.length < 2) {
            return res.boom.badRequest("Malformed authorization");
        }

        let bearerToken = req.headers.authorization.split(' ')[1];

        // TODO reinstate dev backdoor auth
        /*if (bearerToken == process.env.DEVELOPER_AUTH_TOKEN) {
            res.locals.bearerToken = bearerToken;
            next();
        } else*/ if (bearerToken) {
//             getApp().auth().verifyIdToken(bearerToken).then((decodedToken) => {
            app.auth().verifyIdToken(bearerToken).then((decodedToken) => {

//                 res.locals.user = decodedToken;
//                 res.locals.bearerToken = bearerToken;
                console.log("[FirebaseAdminAux] %s", JSON.stringify(decodedToken));
                res.locals.firebase_uid = decodedToken.user_id;
                res.locals.decoded_token = decodedToken;
                res.locals.bearer_token = bearerToken;
                next();
            }).catch((error) => {
                console.log(error.toString());
                res.boom.unauthorized(error.toString());
            });
        } else {
            return res.boom.badRequest("missing auth token");
        }
    }

    return {
        createUser: createUser,
        userExists: userExists,
        validateToken: validateToken,
        initialize: initialize
    }
})();

module.exports = FirebaseAdminAux;
