/* eslint-disable no-prototype-builtins */
/* eslint-disable no-useless-catch */
import * as dotenv from 'dotenv';
dotenv.config({
    path: './.env.test'
})

import 'jest';
import { faker } from '@faker-js/faker';
import { FirebaseAdminAux } from '@lib/firebase-admin-aux';
import sinon from 'sinon';
import {/* Request, Response, */NextFunction } from 'express';
// import UrlParser from 'url-parse';
import httpMocks from 'node-mocks-http';
import { getToken } from './aux-tests';

let m_fbAdminAux;
const m_fbAdminConfigName = faker.lorem.word();
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

    // NOTE: this is already part of the test. Should not create two configurations with the same name
    await m_fbAdminAux.init([
        { name: m_fbAdminConfigName, jsonCredentials: process.env.FIREBASE_TEST_JSON},
        { name: m_fbAdminConfigName, jsonCredentials: process.env.FIREBASE_TEST_JSON}
    ]);

    m_token = await getToken();
});


afterAll(async () => {
    console.log("---AFTER ALL---");
});

describe('Test the queue process validator', () => {
    it('Stub test', async () => {
        expect(1).toBe(1);
    });
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

    it('Should not pull firebase user info as the bearer token is incorrect', async () => {
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

    it('Should not pull firebase user info as the login is incorrect', async () => {
        mockRequest.headers = {
            authorization: `Bearer ${m_token}`
        };
        mockRequest.locals = {};

        await m_fbAdminAux.validateTokenMiddleware(mockRequest, mockRequest, nextFunction);
        expect(mockRequest.locals.firebase_uid).not.toBe(null);
        expect(mockRequest.locals.decoded_token).not.toBe(null);
        expect(typeof mockRequest.locals.decoded_token).toBe('object');
        expect(mockRequest.locals.bearer_token).not.toBe(null);
        expect(typeof mockRequest.locals.bearer_token).toBe('string');

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
    });
});
