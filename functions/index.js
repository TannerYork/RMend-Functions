const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = require('./keys/rmend-789c8-firebase-adminsdk-hmfrb-042a92ca23.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://rmend-789c8.firebaseio.com'
});

exports.saveNewUserData = functions.auth.user().onCreate(async data => {
  admin
    .auth()
    .getUser(data.uid)
    .then(user => {
      return admin
        .auth()
        .setCustomUserClaims(user.uid, { authCode: '', admin: '' })
        .then(() => {
          return admin
            .firestore()
            .collection('users')
            .doc(user.uid)
            .set({
              displayName: user.displayName ? user.displayName : 'New User',
              email: user.email,
              authCode: '',
              admin: false,
              id: user.uid
            });
        });
    })
    .catch(err => {
      console.log(err.message, err.stack);
      return { error: err.message, stack: err.stack };
    });
});
