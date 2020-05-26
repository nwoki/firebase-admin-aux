# Firabase Admin Aux

## Description

A simple nodejs module for performing custom and most common tasks using the firebase admin sdk.


## How to use

<!--```
const express = require("express");

var api = express();

// Don't allow the user past unless the token validation is a success
app.use((req, res, next) => Firebase.validateToken(req, res, next));
```-->

* initialize the module

```

const firebaseAdminAux = require("firebase-admin-aux");

firebaseAdminAux.initialize(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL);

```


## Methods

* `validateToken(req: Express.Request, res: Express.Response, next: callback)`

Used to check if a firebase token is valid for the firebase project in use. This module now uses redis to cache valid tokens in order
to not flood the firebase servers for authentication requests and in order to give you immediate feedback on the validity of the user token

It's thought to be used as middleware in the express request. You should use it in the following way:

```
const express = require("express");
let api = express();

api.use((req, res, next) => firebaseAdminAux.validateToken(req, res, next));

```

This auth function will then load the following variables in the `res.locals` variable:

```
firebase_uid
decoded_token
bearer_token
```


* `createUser(email: string, password: string): Promise`

Creates a basic user via email.

```
firbaseAdminAux.createUser("test@gmail.com", "mdoa!n22Da");
```
