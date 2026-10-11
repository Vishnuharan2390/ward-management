// Ward Management configuration.
//
// LOCAL MODE (default): leave `firebase: null`. Everything is stored in this
// browser only — good for trying the app out, not for sharing.
//
// SHARED MODE: paste your Firebase web config below (see README.md). Everyone
// whose email is added under Settings → Team can sign in with Google and sees
// the same live data.
window.WARD_CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: "...",
  //   authDomain: "your-project.firebaseapp.com",
  //   projectId: "your-project",
  //   appId: "...",
  // },

  // One id per unit/ward. Change it if another unit wants its own board.
  unitId: 'ortho-unit-1',

  // Emails allowed to manage the team list (must match firestore.rules).
  ownerEmails: [
    // 'you@gmail.com',
  ],
};
