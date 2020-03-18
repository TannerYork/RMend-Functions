const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = require('./keys/rmend-789c8-firebase-adminsdk-hmfrb-042a92ca23.json');
// const nodemailer = require('nodemailer');

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
              phoneNumber: '',
              id: user.uid
            });
        });
    })
    .catch(err => {
      console.log(err.message, err.stack);
      return { error: err.message, stack: err.stack };
    });
});

exports.makeUserAdmin = functions.https.onCall((data, context) => {
  if (context.auth.token.admin == '') {
    return {
      error: 'Request not authorized. You do not have the right access to fulfill this request.'
    };
  }

  admin
    .auth()
    .getUser(data.userId)
    .then(user => {
      if (user.customClaims && user.customClaims.admin !== '') {
        return {
          error: `Request not authorized. ${user.displayName} is already an admin for this or another county. If ${user.displayName} was a part of another county before this adn you wish to add them to yours, make sure they remove their old admin status before adding a new one.`
        };
      }
      return admin
        .auth()
        .setCustomUserClaims(user.uid, { admin: context.auth.token.admin })
        .then(() => {
          return admin
            .firestore()
            .collection('users')
            .doc(user.uid)
            .update({ admin: true })
            .then(() => {
              return { result: `${user.displayName} was added as an admin for your county` };
            });
        });
    })
    .catch(err => {
      console.log(err.message, err.stack);
      return { error: err.message, stack: err.stack };
    });
});

exports.updateUserAuthCode = functions.https.onCall((data, context) => {
  admin
    .auth()
    .getUser(context.auth.uid)
    .then(user => {
      return admin
        .auth()
        .setCustomUserClaims(user.uid, { authCode: data.authCode })
        .then(() => {
          return admin
            .firestore()
            .collection('users')
            .doc(user.uid)
            .update({ authCode: data.authCode })
            .then(() => {
              return { result: `Your authority code has been updated.` };
            });
        });
    })
    .catch(err => {
      console.log(err.message, err.stack);
      return { error: err.message, stack: err.stack };
    });
});

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'barrencountyroaddepartment@gmail.com',
    pass: functions.config().email.key
  }
});

exports.sendReportReviewEmail = functions.https.onCall(async (data, context) => {
  if (context.auth.token.moderator !== true)
    return { error: 'ERROR! You need to be a moderator to send emails' };

  const { displayName, magisterialDistrict } = data;
  return admin
    .firestore()
    .collection('users')
    .where('magisterialDistrict', '==', magisterialDistrict)
    .get()
    .then(async districtUsers => {
      return districtUsers
        .forEach(user => {
          const { email } = user.data();
          const mailOptions = {
            from: `Barren County Road Department: ${displayName}`, // Something like: Jane Doe <janedoe@gmail.com>
            to: email,
            subject: 'Report Under Review', // email subject
            html: `<p style="font-size: 16px;">A report in your dirstict is under review.</p>` // email content in HTML
          };
          transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.log(err);
          });
        })
        .then(() => {
          return admin
            .firestore()
            .collection('users')
            .where('magisterialDistrict', '==', 'manager')
            .get()
            .then(managers => {
              return managers.forEach(manager => {
                const { email } = manager.data();
                const mailOptions = {
                  from: `Barren County Road Department: ${displayName}`, // Something like: Jane Doe <janedoe@gmail.com>
                  to: email,
                  subject: 'Report Under Review', // email subject
                  html: `<p style="font-size: 16px;">${message}</p>` // email content in HTML
                };
                transporter.sendMail(mailOptions, (err, info) => {
                  if (err) console.log(err);
                });
                return { result: 'Emails sent to district managers' };
              });
            });
        });
    })
    .catch(err => {
      return { error: err.message, stack: err.stack };
    });
});
