/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Note: You will edit this file in the follow up codelab about the Cloud Functions for Firebase.

// Import the Firebase SDK for Google Cloud Functions.
const functions = require('firebase-functions');
// Import and initialize the Firebase Admin SDK.
const admin = require('firebase-admin');
admin.initializeApp();

// Adds a private article that welcomes new users.
exports.addWelcomeArticles = functions.auth.user().onCreate(async (user) => {
  console.log('A new user signed in for the first time.');
  var time = admin.firestore.FieldValue.serverTimestamp();
  var body = "Hi user_display_name,\n\nWelcome to Yining's Demo!\n\n" +
        "You can view articles, and create / manage your own articles.\n" +
        "Feel free to play with EDIT / DELETE buttons to see  what'll happen " +
        "to this article.\n\nHave fun!\n\nCheers,\nDemo Bot";
  body = body.replace('user_display_name', user.displayName);

  // Saves the new welcome message into the database
  // which then displays it in the FriendlyChat clients.
  await admin.firestore().collection('articles').add({
    authorId: user.uid,
    authorName: user.displayName,
    title: 'Welcome!',
    body: body,
    permission: 'private',
    createdAt: time,
    editedAt: time,
  });
  console.log('Welcome article written to database.');
});

// Delete articles upon user deletion
exports.deleteArticles = functions.auth.user().onDelete(async (user) => {
  var articles = await admin.firestore().collection('articles').where('authorId', '==', user.uid).get();
  await deleteEntries(articles);
});

// Delete tokens upon user deletion
exports.deleteTokens = functions.auth.user().onDelete(async (user) => {
  var tokens = await admin.firestore().collection('fcmTokens').where('uid', '==', user.uid).get();
  await deleteEntries(tokens);
});

function deleteEntries(query) {
  const entriesDelete = [];
  query.forEach((doc) => {
    entriesDelete.push(doc.ref.delete());
  });
  return Promise.all(entriesDelete);
}

// Sends a notifications to all authenticated users when a new article is posted.
exports.sendNotifications = functions.firestore.document('articles/{articleId}').onCreate(
  async (snapshot) => {
    const article = snapshot.data();
    // don't send notifications for private articles
    if (article.permission === 'private') {
      return;
    }

    const payload = {
      notification: {
        title: `New article available!`,
        body: `${article.authorName}: ${article.title}`,
        icon: article.authorProfilePicUrl || '/images/profile_placeholder.png',
        click_action: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
      }
    };

    // Get the list of device tokens.
    const allTokens = await admin.firestore().collection('fcmTokens').get();
    const tokens = [];
    allTokens.forEach((tokenDoc) => {
      if (article.authorId !== tokenDoc.data().uid) {
        tokens.push(tokenDoc.id);
      }
    });

    if (tokens.length > 0) {
      // Send notifications to all tokens.
      const response = await admin.messaging().sendToDevice(tokens, payload);
      await cleanupTokens(response, tokens);
      console.log('Notifications have been sent and tokens cleaned up.');
    }
  });

// Cleans up the tokens that are no longer valid.
function cleanupTokens(response, tokens) {
 // For each notification we check if there was an error.
 const tokensDelete = [];
 response.results.forEach((result, index) => {
   const error = result.error;
   if (error) {
     console.error('Failure sending notification to', tokens[index], error);
     // Cleanup the tokens who are not registered anymore.
     if (error.code === 'messaging/invalid-registration-token' ||
         error.code === 'messaging/registration-token-not-registered') {
       const deleteTask = admin.firestore().collection('messages').doc(tokens[index]).delete();
       tokensDelete.push(deleteTask);
     }
   }
 });
 return Promise.all(tokensDelete);
}
