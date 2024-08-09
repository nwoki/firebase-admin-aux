import 'dotenv/config';
import request, { Response } from 'supertest';

require('dotenv').config({
    path: './.env.test'
})


export async function getToken(firebaseKey: string = process.env.FIREBASE_TEST_KEY as string,
                               email: string = process.env.FIREBASE_TEST_ACCOUNT as string,
                               password: string = process.env.FIREBASE_TEST_PASSWORD as string) : Promise<string | any> {
    const token: string = await new Promise((resolve, reject) => {
        request(`https://identitytoolkit.googleapis.com`)
        .post(`/v1/accounts:signInWithPassword?key=${firebaseKey}`)
        .send({
            email,
            password,
            returnSecureToken: true
        }).end((err: any, res: Response) => {
            if (err) {
                reject(err)
            } else {
                resolve(res.body.idToken as string)
            }
        });
    })

    return token;
}
