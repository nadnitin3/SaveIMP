// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB8BXWi_xXgvcx2kMTkp7xguZVoLTyXMcg",
  authDomain: "saveimp-705f5.firebaseapp.com",
  projectId: "saveimp-705f5",
  storageBucket: "saveimp-705f5.firebasestorage.app",
  messagingSenderId: "591564498881",
  appId: "1:591564498881:web:48384cf04b1207c875b140",
  measurementId: "G-V9QE26VCCE"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Set session persistence to SESSION
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

let sessionTimer;
let credentialsData = []; // Store credentials for filtering

async function getSecretKey() {
  try {
    const doc = await db.collection('settings').doc('secretKey').get();
    if (doc.exists) {
      return doc.data().key;
    } else {
      throw new Error('Secret key not found in settings collection');
    }
  } catch (error) {
    alert('Error fetching secret key: ' + error.message);
    throw error;
  }
}

function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      document.getElementById('loginDiv').style.display = 'none';
      document.getElementById('formDiv').style.display = 'block';
      document.getElementById('userEmail').textContent = `Logged in as: ${userCredential.user.email}`;
      startSessionTimer();
      loadCredentials();
    })
    .catch(error => alert(error.message));
}

function logout() {
  auth.signOut().then(() => {
    document.getElementById('loginDiv').style.display = 'block';
    document.getElementById('formDiv').style.display = 'none';
    document.getElementById('userEmail').textContent = '';
    document.getElementById('email').value = ''; // Clear email field
    document.getElementById('password').value = ''; // Clear password field
    clearTimeout(sessionTimer);
    credentialsData = [];
  });
}

function startSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    if (confirm('Your session has expired. Do you want to renew it?')) {
      startSessionTimer(); // Renew session
      alert('Session renewed successfully!');
    } else {
      alert('Session expired. Please login again.');
      logout();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

async function saveCredential() {
  const site = document.getElementById('site').value.trim();
  const siteUsername = document.getElementById('siteUsername').value.trim();
  const sitePassword = document.getElementById('sitePassword').value.trim();

  if (!site || !siteUsername || !sitePassword) {
    alert('Please fill all fields');
    return;
  }

  try {
    const secretKey = await getSecretKey();
    const encryptedPassword = CryptoJS.AES.encrypt(sitePassword, secretKey).toString();

    db.collection('credentials').add({
      site,
      siteUsername,
      password: encryptedPassword,
      userEmail: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert('Credential saved');
      document.getElementById('site').value = '';
      document.getElementById('siteUsername').value = '';
      document.getElementById('sitePassword').value = '';
      loadCredentials();
    })
    .catch(error => alert(error.message));
  } catch (error) {
    // Error already handled in getSecretKey
  }
}

function loadCredentials() {
  db.collection('credentials')
    .where('userEmail', '==', auth.currentUser.email)
    .orderBy('timestamp', 'desc')
    .get()
    .then(snapshot => {
      credentialsData = [];
      const table = document.getElementById('credentialsTable');
      table.innerHTML = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        credentialsData.push({ id: doc.id, ...data });
      });
      renderCredentials(credentialsData);
    })
    .catch(error => alert(error.message));
}

function renderCredentials(data) {
  const table = document.getElementById('credentialsTable');
  table.innerHTML = '';
  data.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.site}</td>
      <td>${item.siteUsername}</td>
      <td>
        <button class="action-btn" onclick="sendPassword('${item.id}')">Send Password to Email</button>
        <button class="delete-btn" onclick="deleteCredential('${item.id}')">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });
}

function filterCredentials() {
  const searchValue = document.getElementById('search').value.toLowerCase();
  const filteredData = credentialsData.filter(item =>
    item.site.toLowerCase().includes(searchValue) ||
    item.siteUsername.toLowerCase().includes(searchValue)
  );
  renderCredentials(filteredData);
}

async function sendPassword(id) {
  try {
    const doc = await db.collection('credentials').doc(id).get();
    if (doc.exists) {
      const data = doc.data();
      const secretKey = await getSecretKey();
      const decryptedPassword = CryptoJS.AES.decrypt(data.password, secretKey).toString(CryptoJS.enc.Utf8);
      const emailParam = btoa(data.userEmail);
      const url = `https://script.google.com/macros/s/AKfycbwE4PvBvfwPSbv0rGrA6q9bRYvHpsxfe747YF5QujN2qLGWEdKBFxNT445FIatGQlOE/exec` +
                  `?email=${encodeURIComponent(emailParam)}` +
                  `&site=${encodeURIComponent(data.site)}` +
                  `&siteUsername=${encodeURIComponent(data.siteUsername)}` +
                  `&password=${encodeURIComponent(decryptedPassword)}`;

      fetch(url)
        .then(response => response.text())
        .then(result => {
          alert('Password sent to your registered mail ID');
        })
        .catch(err => {
          console.error(err);
          alert('Failed to send email');
        });
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

function deleteCredential(id) {
  if (confirm('Are you sure you want to delete this credential?')) {
    db.collection('credentials').doc(id).delete()
      .then(() => {
        alert('Credential deleted');
        loadCredentials();
      })
      .catch(error => alert(error.message));
  }
}

window.onload = () => {
  document.getElementById('loginDiv').style.display = 'block';
  document.getElementById('formDiv').style.display = 'none';
  document.getElementById('userEmail').textContent = '';
  document.getElementById('email').value = ''; // Clear email field
  document.getElementById('password').value = ''; // Clear password field
  credentialsData = [];

  auth.onAuthStateChanged(user => {
    if (user) {
      document.getElementById('loginDiv').style.display = 'none';
      document.getElementById('formDiv').style.display = 'block';
      document.getElementById('userEmail').textContent = `Logged in as: ${user.email}`;
      startSessionTimer();
      loadCredentials();
    } else {
      document.getElementById('loginDiv').style.display = 'block';
      document.getElementById('formDiv').style.display = 'none';
      document.getElementById('userEmail').textContent = '';
      document.getElementById('email').value = ''; // Clear email field
      document.getElementById('password').value = ''; // Clear password field
      credentialsData = [];
    }
  });
};
