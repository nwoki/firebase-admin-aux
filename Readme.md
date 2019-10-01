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


