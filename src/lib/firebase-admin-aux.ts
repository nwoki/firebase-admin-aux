import admin from 'firebase-admin';
import { App, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { RedisConnection } from './redisconnection';
import UrlParse from 'url-parse';

export interface FirebaseAccountConfig {
    name: string,               // key to identify the configuration with
    jsonCredentials: string     // json credentials of our firebase application
}

export interface FirebaseAdminObj {
    admin: App,
    messaging: Messaging
}

export class FirebaseAdminAux {
    /**
     * key: firebase config name
     * value: firebase admin obj
     */
    private m_firebaseAccounts = new Map<string, FirebaseAdminObj>;
    private m_initialized: boolean = false;
    private m_redisConnection: RedisConnection;// = undefined;// = new RedisConnection();

    constructor(withCache?: boolean, redisUrl?: string) {
        if (withCache) {
            if (!redisUrl) {
                redisUrl = process.env.REDIS_CACHE_URL ?? process.env.REDIS_URL as string ?? 'redis://localhost:6379';
            }

            this.m_redisConnection = new RedisConnection(redisUrl, 'FirebaseAdminAux');
        }

        // https://cloud.google.com/blog/products/containers-kubernetes/kubernetes-best-practices-terminating-with-grace
        process.on('SIGTERM', async () => {
            console.info('SIGTERM signal received.');
            console.info('Closing open Redis connections (if any)');

            await this.m_redisConnection.client().quit();
            process.exit();
        });
    }

    public async init(configs: FirebaseAccountConfig[]) {
        if (this.m_initialized) {
            console.log('FirebaseAdminAux already initialized!');
            return;
        }

        for (const config of configs) {
            // don't overwrite configuration that's already been initialized
            if (this.m_firebaseAccounts.get(config.name)) {
                continue;
            }

            const firebaseAdmin = initializeApp({
                credential: admin.credential.cert(JSON.parse(config.jsonCredentials))
            }, config.name);
            const firebaseMessaging = getMessaging(firebaseAdmin);

            // stash
            this.m_firebaseAccounts.set(config.name, {admin: firebaseAdmin, messaging: firebaseMessaging} as FirebaseAdminObj);
        }

        this.m_initialized = true;

        if (this.m_redisConnection) {
            await this.m_redisConnection.init();
        }
    }

    /**
     * @return FirebaseAdminObj given a config name
     */
    public account(configName: string): FirebaseAdminObj | undefined {
        return this.m_firebaseAccounts.get(configName);
    }
}



// NOTE: add `FirebaseAdminAux` ad default export?




// const FirebaseAdmin = require("firebase-admin");
// const chalk = require("chalk");
// const JSONAPIError = require('jsonapi-serializer').Error;
//
//
// function customError(code, title, message) {
//     return new JSONAPIError({
//         status: code,
//         title: title,
//         detail: message
//     });
// };
//
// function firebaseError(error) {
//     let code = 400;
//
//     if (error.code == "auth/id-token-expired" || error.code == "auth/argument-error"
//         || error.code == "auth/invalid-user-token" || error.code == "auth/user-token-expired") {
//         code = 401;
//     }
//
//     return new JSONAPIError({
//         status: code,
//         title: error.code,
//         detail: error.message
//     });
// };
//
// let FirebaseAdminAux = (function () {
//
//
//     function populateResponseObject(responseObject, decodedTokenObj, bearerToken) {
//         responseObject.locals.firebase_uid = decodedTokenObj.user_id;
//         responseObject.locals.decoded_token = decodedTokenObj;
//         responseObject.locals.bearer_token = bearerToken;
//     }
//
//     function requestVerification(bearerToken, res) {
//         return new Promise((resolve, reject) => {
//             app.auth().verifyIdToken(bearerToken).then((decodedToken) => {
//                 console.log("[FirebaseAdminAux] %s", JSON.stringify(decodedToken));
//
//                 // Stash the token if redis cache is active
//                 if (redisCache) {
//                     redisAuxClient.setWithExpiry("firebase_aux_" + bearerToken, JSON.stringify(decodedToken), (decodedToken.exp - Math.round(new Date() / 1000))).then(() => {
//                         resolve(decodedToken);
//                     }).catch((error) => {
//                         console.error(error);
//                         reject(error);
//                     });
//                 } else {
//                     resolve(decodedToken);
//                 }
//             }).catch((error) => {
//                 console.error(error.toString());
//                 let datError = firebaseError(error);
//                 /*return */res.status(datError.errors[0].status).send(datError);
//                 reject();
//             });
//         });
//     }
//     /**************************************************************/
//
//     function createUser(userEmail, userPassword) {
//         return new Promise((resolve, reject) => {
//             app.auth().createUser({
//                 email: userEmail,
//                 password: userPassword
//             }).then((userRecord) => {
//                 // See the UserRecord reference doc for the contents of userRecord.
//                 console.log("[FirabaseAdminAuth] Successfully created new user: %s", userRecord.uid);
//                 resolve(userRecord);
//             }).catch((error) => {
//                 reject(error);
//             });
//         });
//     }
//
//     function deleteUser(firebaseUid) {
//         return new Promise((resolve, reject) => {
//             app.auth().deleteUser(firebaseUid)
//             .then(() => {
//                 resolve();
//             }).catch((error) => {
//                 reject(error);
//             });
//         });
//     };
//
//     function sendPushNotification(title, body, registrationToken) {
//         let msg = {
//             message: {
//                 notification: {
//                     title: title,
//                     body: body
//                 },
//                 token: registrationToken
//             }
//         };
//
//         app.messaging().send(msg)
//         .then((response) => {
//             // Response is a message ID string.
//             console.log('Successfully sent message:', response);
//         })
//         .catch((error) => {
//             console.log('Error sending message:', error);
//         });
//     };
//
//     function sendMultiplePushNotifications(title, body, registrationTokens) {
//         let msg = {
//             message: {
//                 notification: {
//                     title: title,
//                     body: body
//                 },
//                 tokens: registrationTokens
//             }
//         };
//
//         app.messaging().sendMulticast(msg)
//         .then((response) => {
//             // Response is a message ID string.
//             console.log('Successfully sent message:', response);
//         })
//         .catch((error) => {
//             console.log('Error sending message:', error);
//         });
//     };
//
//     function userExists(userEmail) {
//         return new Promise((resolve, reject) => {
//             if (!app) {
//                 reject(new Error("[FirabaseAdminAuth] You must initialize the module first!"));
//             } else {
//                 app.auth().getUserByEmail(userEmail).then((user) => {
//                     resolve(user);
//                 }).catch((error) => {
//                     reject(error);
//                 });
//             }
//         });
//     };
//
//     var validateToken = (req, res, next) => {
//         if (!req.headers.authorization) {
//             return res.status(401).send(customError(401, "Unauthorized", "Missing authorization"));
//         }
//
//         let split = req.headers.authorization.split(' ');
//
//         if (split.length < 2) {
//             return res.status(400).send(customError(400, "Bad request", "Malformed authorization"));
//         }
//
//         let bearerToken = req.headers.authorization.split(' ')[1];
//
//         if (bearerToken) {
//             // check if the token is already stashed
//             if (redisCache) {
//                 redisAuxClient.get("firebase_aux_" + bearerToken).then((decodedToken) => {
//                     if (decodedToken) {
//                         let decodedObj = JSON.parse(decodedToken);
//
//                         // token is present, already verified and has yet to expire
//                         populateResponseObject(res, decodedObj, bearerToken);
//                         next();
//                     } else {
//                         console.log("Token has expired! Request new verification");
//                         requestVerification(bearerToken, res).then((decodedToken) => {
//                             populateResponseObject(res, decodedToken, bearerToken);
//                             next();
//                         }).catch((firebaseError) => {
//                             console.error(firebaseError);
//                         });
//                     }
//                 }).catch((error) => {
//                     console.error(error);
//                 });
//             } else {
//                 requestVerification(bearerToken, res).then((decodedToken) => {
//                     populateResponseObject(res, decodedToken, bearerToken);
//                     next();
//                 }).catch((error) => {
//                     console.error(error);
//                 });
//             }
//         } else {
//             return res.status(400).send(customError(400, "Bad request", "Missing auth token"));
//         }
//     }
//
//     return {
//         createUser: createUser,
//         deleteUser: deleteUser,
//         sendPushNotification: sendPushNotification,
//         sendMultiplePushNotifications: sendMultiplePushNotifications,
//         userExists: userExists,
//         validateToken: validateToken,
//         initialize
//     }
// })();
//
// module.exports = FirebaseAdminAux;
