/**
 * Copyright 2015 Google Inc. All Rights Reserved.
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
'use strict';

/**
 *
 * Set up Firebase
 *
 */

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

/**
 *
 * Authentication
 *
 */

function signIn() {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
}

function signOut() {
  // Sign out of Firebase.
  firebase.auth().signOut();
}

// Initiate firebase auth.
function initFirebaseAuth() {
  // Listen to auth state changes.
  firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
  return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name.
function getUserName() {
  return firebase.auth().currentUser.displayName;
}

// Returns the signed-in user's UID.
function getUserId() {
  return firebase.auth().currentUser.uid;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
  return !!firebase.auth().currentUser;
}

/**
 *
 * CRUD actions on articles
 *
 */

// Saves a new article in the Cloud Firestore.
function saveArticle(title, body, permission) {
  var time = firebase.firestore.FieldValue.serverTimestamp();
  return firebase.firestore().collection('articles').add({
    authorId: getUserId(),
    authorName: getUserName(),
    authorProfilePicUrl: getProfilePicUrl(),
    title: title,
    body: body,
    permission: permission,
    createdAt: time,
    editedAt: time,
  }).then(function() {
    showAlert('Successfully created article');
    loadArticles();

    // Clear article text field and re-enable the SEND button.
    resetMaterialTextfield(articleTitleInputElement);
    resetMaterialTextfield(articleBodyInputElement);
    toggleArticleButton(submitButtonElement, articleTitleInputElement, articleBodyInputElement);
  }).catch(function(error) {
    showAlert(error.toString());
  });
}

// Updates an article in the Cloud Firestore
function updateArticle(articleId, title, body, permission) {
  var time = firebase.firestore.FieldValue.serverTimestamp();
  firebase.firestore().collection('articles').doc(articleId).update({
    title: title,
    body: body,
    permission: permission,
    editedAt: time,
  }).then(function() {
    showAlert('Successfully saved article');
    loadArticles();
  }).catch(function(error) {
    showAlert(error.toString());
  });
}

// Deletes an article in the Cloud Firestore
function deleteArticle(articleId) {
  firebase.firestore().collection('articles').doc(articleId).delete().then(function() {
    showAlert('Successfully deleted article');
    loadArticles();
  }).catch(function(error) {
    showAlert(error.toString());
  });
}

// Render query results
function loadArticlesWithQuery(query) {
  query.get().then(function(snapshot) {
    snapshot.forEach(function(doc) {
      var articleId = doc.id;
      var articleData = doc.data();
      displayArticle(articleId, articleData);
    });
  }).catch(function(error) {
    showAlert(error.toString());
  });
}

// Loads articles of different permission levels
function loadArticles() {
  // clear article list
  clearArticleListChildren();

  // Create the query to load the last 12 articles and listen for new ones.
  var articlesRef = firebase.firestore().collection('articles');

  if (isUserSignedIn()) {
    // Get public articles
    var query_public = articlesRef.where('permission', '==', "public").orderBy('createdAt', 'desc').limit(10);
    loadArticlesWithQuery(query_public);

    // Get protected articles
    var query_protected = articlesRef.where('permission', '==', "protected").orderBy('createdAt', 'desc').limit(10);
    loadArticlesWithQuery(query_protected);

    // Get private articles owned by current user
    var query_own_private = articlesRef.where('permission', '==', "private").where('authorId', '==', getUserId()).orderBy('createdAt', 'desc').limit(10);
    loadArticlesWithQuery(query_own_private);
  } else {
    // Get public articles
    var query_public = articlesRef.where('permission', '==', "public").orderBy('createdAt', 'desc').limit(10);
    loadArticlesWithQuery(query_public);
  }
}

/**
 *
 * Notification Related
 *
 */

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      // Saving the Device Token to the datastore.
      firebase.firestore().collection('fcmTokens').doc(currentToken)
          .set({uid: firebase.auth().currentUser.uid});
    } else {
      // Need to request permissions to show notifications.
      requestNotificationsPermissions();
    }
  }).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    saveMessagingDeviceToken();
  }).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
}

/**
 *
 * UI related
 *
 */

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user) { // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();

    // Set the user's profile pic and name.
    userPicElement.style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(profilePicUrl) + ')';
    userNameElement.textContent = userName;

    // Show user's profile and sign-out button.
    userNameElement.removeAttribute('hidden');
    userPicElement.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');

    // Hide sign-in button.
    signInButtonElement.setAttribute('hidden', 'true');

    // We save the Firebase Messaging Device token and enable notifications.
    saveMessagingDeviceToken();
    loadArticles();
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    userNameElement.setAttribute('hidden', 'true');
    userPicElement.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');

    // Show sign-in button.
    signInButtonElement.removeAttribute('hidden');
    loadArticles();
  }
}

// Triggered when the send new article form is submitted.
function onArticleFormSubmit(e) {
  e.preventDefault();
  // Check that the user entered article title and body and is signed in.
  if (articleTitleInputElement.value && articleBodyInputElement.value && checkSignedInWithMessage()) {
    var articlePermissionInputElement = document.querySelector('input[name=permission]:checked');
    saveArticle(articleTitleInputElement.value, articleBodyInputElement.value, articlePermissionInputElement.value);
  }
}

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Adds a size to Google Profile pics URLs.
function addSizeToGoogleProfilePic(url) {
  if (url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1) {
    return url + '?sz=150';
  }
  return url;
}

function clearArticleListChildren() {
  var children = articleListElement.querySelectorAll(".article-container");
  children.forEach(function(child) {
    articleListElement.removeChild(child);
  });
}

// Displays an article in the UI.
function displayArticle(articleId, article) {
  var div = articleElementTemplate.content.cloneNode(true).querySelector('.article-container');
  div.setAttribute('id', articleId);
  div.setAttribute('timestamp', article.createdAt);

  // maintain a sorted order while inserting the article to the list
  for (var i = 0; i < articleListElement.children.length; i++) {
    var child = articleListElement.children[i];
    var time = child.getAttribute('timestamp');
    if (time && time < article.createdAt) {
      break;
    }
  }
  articleListElement.insertBefore(div, child);

  div.querySelector('.title').textContent = article.title;
  var articleBodyElement = div.querySelector('.body');
  articleBodyElement.textContent = article.body;
  // Replace all line breaks by <br>.
  articleBodyElement.innerHTML = articleBodyElement.innerHTML.replace(/\n/g, '<br>');

  var metadataElement = div.querySelector('.metadata')

  var permissionIcon;
  switch(article.permission) {
    case "public":
      permissionIcon = 'visibility';
      break;
    case "protected":
      permissionIcon = 'visibility_off';
      break;
    default:
      permissionIcon = 'lock';
  }
  var html = '<i class="material-icons">permission</i>author, created';
  html = html.replace('permission', permissionIcon);
  html = html.replace('author', article.authorName);
  html = html.replace('created', article.createdAt.toDate().toDateString());
  metadataElement.innerHTML = html;

  var editArticleButtonElement = div.querySelector('.mdl-card__actions').querySelector('.edit');
  var deleteArticleButtonElement = div.querySelector('.mdl-card__actions').querySelector('.delete');
  if (isAuthor(article)) {
    // show dialog modals when clicking action buttons
    editArticleButtonElement.addEventListener('click', () => {
      showEditDialog(articleId, article);
    });
    deleteArticleButtonElement.addEventListener('click', () => {
      showDeleteDialog(articleId, article);
    });
  } else {
    // disable action buttons if user isn't author
    editArticleButtonElement.setAttribute('hidden', 'true');
    deleteArticleButtonElement.setAttribute('hidden', 'true');
  }
}

// Enables or disables the button depending on the values of the input fields.
function toggleArticleButton(button, title, body) {
  if (title.value && body.value) {
    button.removeAttribute('disabled');
  } else {
    button.setAttribute('disabled', 'true');
  }
}

// Show dialog to edit an article
function showEditDialog(articleId, article) {
  var dialog = document.getElementById('edit-dialog');
  dialog.setAttribute('data-article-id', articleId);

  var articleTitle = dialog.querySelector('#article-title');
  articleTitle.value = article.title;

  var articleBody = dialog.querySelector('#article-body');
  articleBody.textContent = article.body;

  var permissionRadioElementId = '#permission-' + article.permission;
  var permissionRadioElement = dialog.querySelector(permissionRadioElementId);
  permissionRadioElement.setAttribute('checked', 'checked');
  permissionRadioElement.parentElement.classList.add('is-checked');

  var saveArticleButton = dialog.querySelector('.save-article');

  articleTitle.addEventListener('keyup', () => {
    toggleArticleButton(saveArticleButton, articleTitle, articleBody);
  });
  articleTitle.addEventListener('change', () => {
    toggleArticleButton(saveArticleButton, articleTitle, articleBody);
  });
  articleBody.addEventListener('keyup', () => {
    toggleArticleButton(saveArticleButton, articleTitle, articleBody);
  });
  articleBody.addEventListener('change', () => {
    toggleArticleButton(saveArticleButton, articleTitle, articleBody);
  });

  dialog.showModal();
}

// Show dialog to delete an article
function showDeleteDialog(articleId, article) {
   var dialog = document.getElementById('delete-dialog');
   dialog.setAttribute('data-article-id', articleId);
   dialog.showModal();
}

// Display alert in snackbar
function showAlert(message) {
  var data = { message: message, timeout: 5000 };
  alertSnackbarElement.MaterialSnackbar.showSnackbar(data);
}

/**
 *
 * Utilities
 *
 */

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
  // Return true if the user is signed in Firebase
  if (isUserSignedIn()) {
    return true;
  }
  showAlert('You must sign-in first');
  return false;
}

// Whether the current user is the author of given article
function isAuthor(article) {
  return isUserSignedIn() && article.authorId == getUserId();
}


/**
 *
 * Execution
 *
 */

// Checks that Firebase has been imported.
checkSetup();

// Shortcuts to DOM Elements.
var articleListElement = document.getElementById('articles');
var articleFormElement = document.getElementById('article-form');
var articleTitleInputElement = document.getElementById('article-title');
var articleBodyInputElement = document.getElementById('article-body');
var submitButtonElement = document.getElementById('submit');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var alertSnackbarElement = document.getElementById('alert-snackbar');
var articleElementTemplate = document.getElementById('article-template');
var editDialog = document.getElementById('edit-dialog');
var deleteDialog = document.getElementById('delete-dialog');

// Saves article on form submit.
articleFormElement.addEventListener('submit', onArticleFormSubmit);
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// Toggle for the button.
articleTitleInputElement.addEventListener('keyup', () => {
  toggleArticleButton(submitButtonElement, articleTitleInputElement, articleBodyInputElement);
});
articleTitleInputElement.addEventListener('change', () => {
  toggleArticleButton(submitButtonElement, articleTitleInputElement, articleBodyInputElement);
});
articleBodyInputElement.addEventListener('keyup', () => {
  toggleArticleButton(submitButtonElement, articleTitleInputElement, articleBodyInputElement);
});
articleBodyInputElement.addEventListener('change', () => {
  toggleArticleButton(submitButtonElement, articleTitleInputElement, articleBodyInputElement);
});

// event listeners for edit dialog
editDialog.querySelector('.close-edit-dialog').addEventListener('click', () => {
  editDialog.close();
});
editDialog.querySelector('.save-article').addEventListener('click', () => {
  var articleId = editDialog.getAttribute('data-article-id');
  var title = editDialog.querySelector('#article-title').value;
  var body = editDialog.querySelector('#article-body').value;
  var permission = editDialog.querySelector('input[name=permission-edit]:checked').value;
  updateArticle(articleId, title, body, permission);
  editDialog.close();
});

// event listeners for delete dialog
deleteDialog.querySelector('.close-delete-dialog').addEventListener('click', () => {
  deleteDialog.close();
});
deleteDialog.querySelector('.delete-article').addEventListener('click', () => {
  var articleId = deleteDialog.getAttribute('data-article-id');
  deleteArticle(articleId);
  deleteDialog.close();
});

// initialize Firebase
initFirebaseAuth();
