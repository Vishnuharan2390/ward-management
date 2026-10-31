// Ward Management configuration.
//
// SHARED MODE is on: everyone whose email is on the team list (Settings →
// Team) signs in and sees the same live data. Set `firebase: null` to go
// back to single-device local mode.
//
// These values identify the Firebase project; they are not passwords.
// Access is controlled by firestore.rules (team list + verified email).
window.WARD_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyBI8bub3UpXN-fxBzlbWryzBdZigtt88Us',
    authDomain: 'ortho-ward-c2e69.firebaseapp.com',
    projectId: 'ortho-ward-c2e69',
  },

  // One id per unit/ward. Change it if another unit wants its own board.
  unitId: 'ortho-unit-1',

  // Emails allowed to manage the team list (must match firestore.rules).
  ownerEmails: [
    'vishnuapple9.1@gmail.com',
  ],
};
