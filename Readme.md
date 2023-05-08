# Firabase Admin Aux

## Description

A simple nodejs module for performing custom and most common tasks using the firebase admin sdk. It has the possibility to cache user authentication
info to avoid constantly polling the firebase servers. In order to do this, you'll have to provide the redis connection url and port via
environment variable: `REDIS_CACHE_URL` (`redis://<host>:<port>`)

## Environment variables

```
FIREBASE_AUTH_JSON
REDIS_CACHE_URL
```

# For testing purposes, integrate with the following
```
FIREBASE_TEST_JSON
FIREBASE_TEST_ACCOUNT
FIREBASE_TEST_PASSWORD
FIREBASE_TEST_KEY
FIREBASE_TEST_UID
```

## How to use

```
import { FirebaseAdminAux } from '@lib/firebase-admin-aux';

const m_fbAdminAux = new FirebaseAdminAux(true);

await m_fbAdminAux.init([
    { name: 'myconfigName1', jsonCredentials: process.env.FIREBASE_AUTH_JSON},
    { name: 'myConfigName2', jsonCredentials: process.env.FIREBASE_AUTH_JSON_TWO},
    ...,
    ...
]);

// set the instance so we don't go creating extra copies around the project
FirebaseAdminAux.setInstance(m_fbAdminAux);


// Now you can operate on the m_fbAdminAux instance
```


## TODO

