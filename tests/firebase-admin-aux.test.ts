/* eslint-disable no-prototype-builtins */
/* eslint-disable no-useless-catch */
import * as dotenv from 'dotenv';
dotenv.config({
    path: './.env.test'
})

import 'jest';
import { faker } from '@faker-js/faker';
import { FirebaseAdminAux, CreateUserData, UpdateUserData } from '@lib/firebase-admin-aux';
import sinon from 'sinon';
import {/* Request, Response, */NextFunction } from 'express';
// import UrlParser from 'url-parse';
import httpMocks from 'node-mocks-http';
import { getToken } from './aux-tests';

let m_fbAdminAux;
let m_fbAdminAuxNoCache;

const m_fbAdminConfigName = faker.lorem.word();
const m_fbAdminNoCacheConfigName = faker.lorem.word();

let m_token;


/*
const mockResponse = () => {
    const res = {};
    res.status = sinon.stub().returns(res);
    res.json = sinon.stub().returns(res);
    return res;
};

const mockRequest = (queryData) => {
    return {
        query: { data: queryData }
    };
};*/



// NOTE: crate fake api to test the middleware. That way i can use supertest and have req/res automagically ready



beforeAll(async () => {
    // Prepare the firebase account with default redis url (localhost)
    m_fbAdminAux = new FirebaseAdminAux(true);
    m_fbAdminAuxNoCache = new FirebaseAdminAux(false);


    // NOTE: this is already part of the test. Should not create two configurations with the same name
    await m_fbAdminAux.init([
        { name: m_fbAdminConfigName, jsonCredentials: process.env.FIREBASE_TEST_JSON},
        { name: m_fbAdminConfigName, jsonCredentials: process.env.FIREBASE_TEST_JSON}
    ]);

    await m_fbAdminAuxNoCache.init([
        { name: m_fbAdminNoCacheConfigName, jsonCredentials: process.env.FIREBASE_TEST_JSON}
    ]);

    m_token = await getToken();
});


afterAll(async () => {
    console.log("---AFTER ALL---");
});

describe('Test the FirebaseAdminAux setup', () => {
    it('Should not re-initialize the same object - used for code coverage', async () => {
        await m_fbAdminAux.init([]);
    });
});

describe('Test the FirebaseAdminAux functions - Account', () => {
    it('Should non return a non existing account', async () => {
        expect(m_fbAdminAux.account(faker.lorem.word())).toBe(undefined);
    });

    it('Should return a stashed account', async () => {
        expect(m_fbAdminAux.account(m_fbAdminConfigName)).not.toBe(undefined);
    });
})

describe('Test the FirebaseAdminAux authentication middleware', () => {
    let nextFunction: NextFunction = jest.fn();
    let mockRequest = httpMocks.createRequest({
    });
    let mockResponse = httpMocks.createResponse({});

    beforeEach(() => {
        mockRequest.headers = {};
        mockRequest.query = {};
        mockResponse.statusCode = undefined;
    });

    it('Should fail due to missing Authorization header', async () => {
        await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.statusCode).toBe(401);
    });

    xit('Should fail due to missing query parameters (only if i have more than one configuration)', async () => {
        mockRequest.headers = {
            authorization: `Bearer ${faker.datatype.uuid()}`
        };

        await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.statusCode).toBe(400);
    });

    it('Should not pass due to malformed authentication header', async () => {
        mockRequest.headers = {
            authorization: `Bearer`
        };

        await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.statusCode).toBe(400);
    });

    it('Should fail due to missing token', async () => {
        mockRequest.headers = {
            authorization: `Bearer  `
        };

        await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.statusCode).toBe(400);
    });

    it('Should fail due to missing firebase account', async () => {
        mockRequest.headers = {
            authorization: `Bearer ${m_token}`
        };

        mockRequest.query = {
            firebase_config: faker.lorem.word()
        }

        try {
            await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockRequest, nextFunction);
        } catch (error: any) {
            expect(error.message).toBe('account not found');
        }
    });

    it('Should not pull firebase user info through validation middleware as the bearer token is incorrect', async () => {
        mockRequest.headers = {
            authorization: `Bearer ${faker.datatype.uuid()}`
        };
        mockRequest.locals = {};

        try {
            await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockRequest, nextFunction);
        } catch (error: any) {
            expect(error.message).not.toBe(null);
        }
    });

    it('Should pull firebase user info through validation middleware', async () => {
        mockRequest.headers = {
            authorization: `Bearer ${m_token}`
        };
        mockRequest.locals = {};

        await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockRequest, nextFunction);
        expect(mockRequest.locals.firebase_uid).toBe(process.env.FIREBASE_TEST_UID as string);
        expect(mockRequest.locals.decoded_token).not.toBe(null);
        expect(typeof mockRequest.locals.decoded_token).toBe('object');
        expect(mockRequest.locals.bearer_token).not.toBe(null);
        expect(typeof mockRequest.locals.bearer_token).toBe('string');
        expect(nextFunction).toHaveBeenCalledTimes(1);
        expect(mockRequest.locals.email).toBe(process.env.FIREBASE_TEST_ACCOUNT as string);

        // update my token
        m_token = mockRequest.locals.bearer_token;
    });

    it('Should pull info from redis cache', async () => {
        mockRequest.headers = {
            authorization: `Bearer ${m_token}`
        };
        mockRequest.locals = {};

        await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockRequest, nextFunction);
        expect(mockRequest.locals).not.toBe(null);
        expect(mockRequest.locals.firebase_uid).toBe(process.env.FIREBASE_TEST_UID as string);
    });
});


describe('Test the FirebaseAdminAux authentication middleware NO CACHE', () => {
    let nextFunction: NextFunction = jest.fn();
    let mockRequest = httpMocks.createRequest({
    });
    let mockResponse = httpMocks.createResponse({});

    beforeEach(() => {
        mockRequest.headers = {};
        mockRequest.query = {};
        mockResponse.statusCode = undefined;
    });

    it('Should pull firebase user info through validation middleware (NO CACHE)', async () => {
        mockRequest.headers = {
            authorization: `Bearer ${m_token}`
        };
        mockRequest.locals = {};

        await m_fbAdminAuxNoCache.validateTokenMiddleware(mockRequest, mockRequest, nextFunction);
        expect(mockRequest.locals.firebase_uid).toBe(process.env.FIREBASE_TEST_UID as string);
        expect(mockRequest.locals.decoded_token).not.toBe(null);
        expect(typeof mockRequest.locals.decoded_token).toBe('object');
        expect(mockRequest.locals.bearer_token).not.toBe(null);
        expect(typeof mockRequest.locals.bearer_token).toBe('string');
        expect(nextFunction).toHaveBeenCalledTimes(1);

        // update my token
        m_token = mockRequest.locals.bearer_token;
    });
});

describe('Test the user operations', () => {
    let nextFunction: NextFunction = jest.fn();
    let mockRequest = httpMocks.createRequest({
    });
    let mockResponse = httpMocks.createResponse({});

    const m_userCreateData : CreateUserData = {
        email: faker.internet.email(),
        displayName: faker.lorem.word(),
        password: faker.internet.password()
    };

    const m_userUpdateData: UpdateUserData = {
        displayName: faker.lorem.word(),
        phoneNumber: faker.phone.number('+4891#######'),
        emailVerified: true
    };

    let m_userFirebaseUid;

    console.log(m_userUpdateData);

    beforeEach(() => {
        mockRequest.headers = {};
        mockRequest.query = {};
        mockResponse.statusCode = undefined;
    });

    it('Should create a new user', async () => {
        const rec = await m_fbAdminAux.createUser(m_userCreateData);

        expect(rec.email).toBe(m_userCreateData.email.toLowerCase());
        expect(rec.displayName).toBe(m_userCreateData.displayName);

        m_userFirebaseUid = rec.uid;
    });

    it('Should update a user and check new data is correctly stored on firebase', async () => {
        await m_fbAdminAux.updateUser(m_userFirebaseUid, m_userUpdateData);
        const user = await m_fbAdminAux.getUser(m_userFirebaseUid);

        expect(user.displayName).toBe(m_userUpdateData.displayName);
        expect(user.phoneNumber).toBe(m_userUpdateData.phoneNumber);
        expect(user.emailVerified).toBe(m_userUpdateData.emailVerified);
    });

    it('Should delete the newly created user', async () => {
        await m_fbAdminAux.deleteUser(m_userFirebaseUid);
        expect('all is well').toBe('all is well');
    });


});
