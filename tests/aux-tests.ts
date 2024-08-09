// import * as dotenv from 'dotenv';
import 'dotenv/config';
import request, { Response } from 'supertest';

require('dotenv').config({
    path: './.env.test'
})


export async function getToken(firebaseKey: string = process.env.FIREBASE_TEST_KEY as string,
                               email: string = process.env.FIREBASE_TEST_ACCOUNT as string,
                               password: string = process.env.FIREBASE_TEST_PASSWORD as string) : Promise<string | any> {
    const tokenMap = new Map<string, string>();
    const keyMap: string = firebaseKey + email + password;
    const cachedToken = tokenMap.get(keyMap);

    if (cachedToken) {
        return cachedToken;
    } else {
        const token: string = await new Promise((resolve, reject) => {
            request('https://www.googleapis.com')
            .post(`/identitytoolkit/v3/relyingparty/verifyPassword?key=${firebaseKey}`)
            .send({ email, password, returnSecureToken: true })
            .end((err, res: Response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res.body.idToken as string);
                }
            });
        });

        tokenMap.set(keyMap, token);
        return token;
    }
}
