import * as dotenv from 'dotenv';
import request from 'supertest';

dotenv.config({
    path: './.env.test'
})


export async function getToken(firebaseKey: string = process.env.FIREBASE_KEY as string,
                               email: string = process.env.FIREBASE_TEST_ACCOUNT as string,
                               password: string = process.env.FIREBASE_TEST_PASSWORD as string) {

    const tokenMap = new Map();
    const keyMap = firebaseKey + email + password;

    const cachedToken = tokenMap.get(keyMap);
    if (cachedToken) return cachedToken;

    const token = await new Promise((resolve, reject) => {
        request('https://www.googleapis.com')
        .post(`/identitytoolkit/v3/relyingparty/verifyPassword?key=${firebaseKey}`)
        .send({ email, password, returnSecureToken: true })
        .end((err, res) => {
            if (err) reject(err);
            resolve(res.body.idToken);
        });
    });

    tokenMap.set(keyMap, token);
    return token;
}
