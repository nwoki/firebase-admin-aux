import admin from 'firebase-admin';
import { App, initializeApp } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { RedisConnection } from './redisconnection';
import UrlParse from 'url-parse';
import { Request, Response, NextFunction } from 'express';
import { Error as JSONAPIError } from 'jsonapi-serializer';

function customError(status: number, title: string, message: string) : JSONAPIError {
    return new JSONAPIError({
        status: status,
        title: title,
        detail: message
    });
};


export interface FirebaseAccountConfig {
    name: string,               // key to identify the configuration with
    jsonCredentials: string     // json credentials of our firebase application
}

export interface FirebaseAdminObj {
    admin: App,
    auth: Auth,
    messaging: Messaging
}

export interface CreateUserData {
    email: string,
    emailVerified?: boolean,
    password: string,
    displayName?: string,
    phoneNumber?: string,
    photoURL?: string,
    disabled?: boolean
}

export interface UpdateUserData {
    email?: string,
    emailVerified?: boolean,
    password?: string,
    displayName?: string,
    phoneNumber?: string,
    photoURL?: string,
    disabled?: boolean
}

export class FirebaseAdminAux {
    /**
     * key: firebase config name
     * value: firebase admin obj
     */
    private m_firebaseAccounts = new Map<string, FirebaseAdminObj>;
    private m_initialized: boolean = false;
    private m_redisConnection: RedisConnection;// = undefined;// = new RedisConnection();

    constructor(withCache?: boolean) {
        if (withCache) {
            this.m_redisConnection = new RedisConnection(null, 'FirebaseAdminAux');
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
            const firebaseAuth = getAuth(firebaseAdmin);
            const firebaseMessaging = getMessaging(firebaseAdmin);

            // stash
            this.m_firebaseAccounts.set(config.name, {admin: firebaseAdmin, auth: firebaseAuth, messaging: firebaseMessaging} /*as FirebaseAdminObj*/);
        }

        if (this.m_redisConnection) {
            await this.m_redisConnection.init();
        }

        this.m_initialized = true;
    }

    /**
     * @return FirebaseAdminObj given a config name
     */
    public account(configName: string): FirebaseAdminObj | undefined {
        return this.m_firebaseAccounts.get(configName);
    }

    private async lookupFirebaseUser(bearerToken: string, res: Response, configName?: string) {
        const firebaseAccount = this.getConfigAccountForFunctions(configName);
        const decodedToken = await firebaseAccount.auth.verifyIdToken(bearerToken);

        // do we have cache enabled?
        if (this.m_redisConnection) {
            await this.m_redisConnection.setWithExpiry(`firebase_aux_${bearerToken}`, JSON.stringify(decodedToken), ((decodedToken.exp - Math.round(new Date() as any / 1000))));
        }

        this.populateResponseObject(res, decodedToken, bearerToken);
    }

    /**
     * NOTE: put this info in a sub object? Something that identifies that the info is from this lib? Maybe an object
     * called 'firebase_admin_aux {}' ?
     */
    private populateResponseObject(res: Response, decodedTokenObj: any, bearerToken: string) {
        res.locals['firebase_uid'] = decodedTokenObj.uid;
        res.locals['decoded_token'] = decodedTokenObj;
        res.locals['bearer_token'] = bearerToken;
        res.locals['email'] = decodedTokenObj.email;
        res.locals['email_verified'] = decodedTokenObj.email_verified;
    }

    public async validateTokenMiddleware(req: Request, res: Response, next: NextFunction) {
        /* no sense in checking for auth if there's no Authorization header, is there? */
        if (!Object.hasOwn(req.headers, 'authorization')) {
            console.log(req.headers.authorization);
            return res.status(401).send(customError(401, 'Unauthorized', 'Missing authorization'));
        }

        /* check that the request has the firebase configuration name specified if we're handling more than one
         * active configuration. If that's not the case, allow no configuration to be specified otherwise fail the request
         */
        if ((this.m_firebaseAccounts.size != 1) && (!Object.hasOwn(req.query, 'firebase_config'))) {
            return res.status(400).send(customError(400, 'Bad request', 'Missing firebase config specification'));
        }

        const split = req.headers.authorization.split(' ');

        if (split.length < 2) {
            return res.status(400).send(customError(400, 'Bad request', 'Malformed authorization'));
        }

        const bearerToken = req.headers.authorization.split(' ')[1];
        const firebastConfig = req.query.firebase_config ?? '';

        if (bearerToken) {
            // check if the token is already stashed
            if (this.m_redisConnection) {
                // TODO - freeze the key string used here
                const decodedToken = await this.m_redisConnection.get(`firebase_aux_${bearerToken}`);

                if (decodedToken) {
                    const decodedObj: any = JSON.parse(decodedToken);
                    this.populateResponseObject(res, decodedObj, bearerToken);
                } else {
                    await this.lookupFirebaseUser(bearerToken, res, req.query.firebase_config as string ?? undefined);
                }
            } else {
                // token is not stashed, pull from firebase
                await this.lookupFirebaseUser(bearerToken, res, req.query.firebase_config as string ?? undefined);
            }

            // move on
            next();
        } else {
            return res.status(400).send(customError(400, 'Bad request', 'Missing auth token'));
        }
    };



    /****************************
     * FIREBASE WRAPPER ACTIONS *
     ****************************/
    private getConfigAccountForFunctions(configName?: string) {
        const firebaseAccount = configName ? this.account(configName) : this.m_firebaseAccounts.entries().next().value[1];

        if (!firebaseAccount) {
            throw new Error('account not found');
        } else {
            return firebaseAccount;
            }
    };

    public async createUser(userData: CreateUserData, configName?: string) {
        const firebaseAccount = this.getConfigAccountForFunctions(configName);
        const userRecord = await firebaseAccount.auth.createUser(userData);

        // console.log(userRecord);
        return userRecord;
    };

    public async deleteUser(userFirebaseUid: string, configName?: string) {
        const firebaseAccount = this.getConfigAccountForFunctions(configName);
        await firebaseAccount.auth.deleteUser(userFirebaseUid);
    }

    public async getUser(userFirebaseUid: string, configName?: string) {
        const firebaseAccount = this.getConfigAccountForFunctions(configName);
        const userData = await firebaseAccount.auth.getUser(userFirebaseUid);
        return userData;
    }

    public async updateUser(userFirebaseUid: string, userData: UpdateUserData, configName?: string) {
        const firebaseAccount = this.getConfigAccountForFunctions(configName);
        const userRecord = await firebaseAccount.auth.updateUser(userFirebaseUid, userData);
        return userRecord;
    }

    public async userExists(userEmail: string, configName?: string) {
        const firebaseAccount = this.getConfigAccountForFunctions(configName);
        const userRecord = await firebaseAccount.auth.getUserByEmail(userEmail);
        return userRecord;
    }
}

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

