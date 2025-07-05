
document.addEventListener("DOMContentLoaded", function () {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  const addAccountBtn = document.getElementById("addAccountBtn");
  if (addAccountBtn) {
    addAccountBtn.addEventListener("click", () => {
      loadPage('addAccount');
    });
  }

  const dailyWorkBtn = document.getElementById("dailyWorkBtn");
  if (dailyWorkBtn) {
    dailyWorkBtn.addEventListener("click", () => {
      loadPage('dailyWork');
    });
  }

  const memberManageBtn = document.getElementById("memberManageBtn");
  if (memberManageBtn) {
    memberManageBtn.addEventListener("click", () => {
      loadPage('memberManage');
    });
  }

  // 你可以依照實際按鈕 ID 繼續加入更多頁面載入綁定
});

function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error('登出錯誤：', error);
  });
}

function loadPage(pageName) {
  fetch(`pages/${pageName}.html`)
    .then(response => response.text())
    .then(html => {
      document.getElementById("content").innerHTML = html;
    })
    .catch(error => {
      console.error("載入頁面錯誤：", error);
    });
}
