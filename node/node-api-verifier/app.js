// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Verifiable Credentials Sample

///////////////////////////////////////////////////////////////////////////////////////
// Node packages
var express = require('express')
var session = require('express-session')
var base64url = require('base64url')
var secureRandom = require('secure-random');
var bodyParser = require('body-parser')
// mod.cjs
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const https = require('https')
const url = require('url')
const { SSL_OP_COOKIE_EXCHANGE } = require('constants');
var msal = require('@azure/msal-node');
const fs = require('fs');
const crypto = require('crypto');
var uuid = require('uuid');

///////////////////////////////////////////////////////////////////////////////////////
// config file can come from command line, env var or the default
var config = {
  "azTenantId": process.env.azTenantId,
  "azClientId":  process.env.azClientId,
  "azClientSecret": process.env.azClientSecret,
  "VerifierAuthority": process.env.VerifierAuthority,
  "CredentialType": process.env.CredentialType,
  "apiKey": uuid.v4()
}
module.exports.config = config;

///////////////////////////////////////////////////////////////////////////////////////
// MSAL
var msalConfig = {
  auth: {
      clientId: config.azClientId,
      authority: `https://login.microsoftonline.com/${config.azTenantId}`,
      clientSecret: config.azClientSecret,
  },
  system: {
      loggerOptions: {
          loggerCallback(loglevel, message, containsPii) {
              console.log(message);
          },
          piiLoggingEnabled: false,
          logLevel: msal.LogLevel.Verbose,
      }
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);
const msalClientCredentialRequest = {
  scopes: ["3db474b9-6a0c-4840-96ac-1fceb342124f/.default"],
  skipCache: false, 
};
module.exports.msalCca = cca;
module.exports.msalClientCredentialRequest = msalClientCredentialRequest;

config.msIdentityHostName = "https://verifiedid.did.msidentity.com/v1.0/";

///////////////////////////////////////////////////////////////////////////////////////
// check that we a) can acquire an access_token and b) that it has the needed permission for this sample
cca.acquireTokenByClientCredential(msalClientCredentialRequest).then((result) => {
  if ( !result.accessToken ) {
    throw new Error( `Could not acquire access token. Check your configuration for tenant ${config.azTenantId} and clientId ${config.azClientId}` );
  } else {
    console.log( `access_token: ${result.accessToken}` ); 
    var accessToken = JSON.parse(base64url.decode(result.accessToken.split(".")[1]));
    if ( accessToken.roles != "VerifiableCredential.Create.All" ) {
      throw new Error( `Access token do not have the required scope 'VerifiableCredential.Create.All'.` );  
    }
  }
}).catch((error) => {
    console.log(error);
    throw new Error( `Could not acquire access token. Check your configuration for tenant ${config.azTenantId} and clientId ${config.azClientId}` );
  });


///////////////////////////////////////////////////////////////////////////////////////
// Main Express server function
// Note: You'll want to update port values for your setup.
const app = express()
const port = process.env.PORT || 8080;

var parser = bodyParser.urlencoded({ extended: false });

// Serve static files out of the /public directory
app.use(express.static('public'))

// Set up a simple server side session store.
// The session store will briefly cache issuance requests
// to facilitate QR code scanning.
var sessionStore = new session.MemoryStore();
app.use(session({
  secret: 'cookie-secret-key',
  resave: false,
  saveUninitialized: true,
  store: sessionStore
}))

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Origin, X-Requested-With, Content-Type, Accept");
  next();
});

module.exports.sessionStore = sessionStore;
module.exports.app = app;

function requestTrace( req ) {
  var dateFormatted = new Date().toISOString().replace("T", " ");
  var h1 = '//****************************************************************************';
  console.log( `${h1}\n${dateFormatted}: ${req.method} ${req.protocol}://${req.headers["host"]}${req.originalUrl}` );
  console.log( `Headers:`)
  console.log(req.headers);
}

// echo function so you can test that you can reach your deployment
app.get("/echo",
    function (req, res) {
        requestTrace( req );
        res.status(200).json({
            'date': new Date().toISOString(),
            'api': req.protocol + '://' + req.hostname + req.originalUrl,
            'Host': req.hostname,
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-original-host': req.headers['x-original-host'],
          //  'IssuerAuthority': config.IssuerAuthority,
            'VerifierAuthority': config.VerifierAuthority,
          //  'manifestURL': config.CredentialManifest,
            'clientId': config.azClientId,
            'configFile': configFile
            });
    }
);

// Serve index.html as the home page
app.get('/', function (req, res) { 
  requestTrace( req );
  res.sendFile('public/index.html', {root: __dirname})
})

var verifier = require('./verifier.js');

// start server
app.listen(port, () => console.log(`Example issuer app listening on port ${port}!`))